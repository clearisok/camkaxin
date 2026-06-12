import type { PoolClient } from 'pg';
import { getClient } from '../config/database.js';

import {

  addDaysYmd,

  inferZoneFromRow,

  isProductionGroup,

  todayYmd,

  toYmd,

} from '../utils/schedulingZone.js';

import { enrichStyle } from '../utils/styleCalculations.js';

import type { StyleRow } from '../utils/styleCalculations.js';

import {

  buildChildRowFromParent,

  sumAllocatedQuantity,

} from './styleAllocation.js';



export interface ScheduleStyleInput {

  schedule_qty: number;

  required_days: number;

  is_outsourced: boolean;

  group_name?: string | null;

  outsourced_factory?: string | null;

  outsourced_price?: number | null;

  scheduling_remarks?: string | null;

}



async function lastOfflineInBucket(

  zone: 'group' | 'outsource',

  groupName: string | null,

  client: PoolClient,

): Promise<string | null> {

  if (zone === 'group') {

    const res = await client.query<{ offline_time: string | Date }>(

      `SELECT offline_time FROM styles

       WHERE scheduling_zone = 'group' AND group_name = $1 AND offline_time IS NOT NULL

       ORDER BY sort_order DESC NULLS LAST, offline_time DESC NULLS LAST, id DESC

       LIMIT 1`,

      [groupName],

    );

    return toYmd(res.rows[0]?.offline_time);

  }

  const res = await client.query<{ offline_time: string | Date }>(

    `SELECT offline_time FROM styles

     WHERE scheduling_zone = 'outsource' AND offline_time IS NOT NULL

     ORDER BY sort_order DESC NULLS LAST, offline_time DESC NULLS LAST, id DESC

     LIMIT 1`,

  );

  return toYmd(res.rows[0]?.offline_time);

}



async function nextSortOrder(

  zone: 'group' | 'outsource',

  groupName: string | null,

  client: PoolClient,

): Promise<number> {

  if (zone === 'group') {

    const res = await client.query(

      `SELECT MAX(sort_order) AS max FROM styles

       WHERE scheduling_zone = 'group' AND group_name = $1`,

      [groupName],

    );

    return (res.rows[0]?.max ?? -1) + 1;

  }

  const res = await client.query(

    `SELECT MAX(sort_order) AS max FROM styles WHERE scheduling_zone = 'outsource'`,

  );

  return (res.rows[0]?.max ?? -1) + 1;

}



export async function scheduleStyle(

  id: number,

  input: ScheduleStyleInput,

  changedBy = 'schedule-style',

) {

  const client = await getClient();

  try {

    await client.query('BEGIN');



    const parentRes = await client.query('SELECT * FROM styles WHERE id = $1 FOR UPDATE', [id]);

    const parent = parentRes.rows[0] as Record<string, unknown> | undefined;

    if (!parent) throw new Error('款式不存在');

    if (parent.parent_style_id != null) throw new Error('只能对订单母单执行排单');

    if (inferZoneFromRow(parent as { scheduling_zone?: string | null; group_name?: string | null }) !== 'wait') {

      throw new Error('仅待排单款式可执行排单');

    }



    const orderQty = Number(parent.quantity);

    if (!Number.isFinite(orderQty) || orderQty < 1) {

      throw new Error('订单数量未填写，请先完善订单数量');

    }



    const scheduleQty = Number(input.schedule_qty);

    if (!Number.isFinite(scheduleQty) || !Number.isInteger(scheduleQty) || scheduleQty < 1) {

      throw new Error('排入数量须为正整数');

    }



    const allocated = await sumAllocatedQuantity(id, client);

    const remaining = orderQty - allocated;

    if (scheduleQty > remaining) {

      throw new Error(`排入数量超出未排数量（当前未排 ${remaining}）`);

    }



    const requiredDays = Number(input.required_days);

    if (!Number.isFinite(requiredDays) || requiredDays < 1) {

      throw new Error('所需天数必填且须大于 0');

    }



    const today = todayYmd();

    let zonePatch: Record<string, unknown>;



    if (input.is_outsourced) {

      const factory = String(input.outsourced_factory ?? '').trim();

      if (!factory) throw new Error('外发工厂必填');

      const price = Number(input.outsourced_price);

      if (!Number.isFinite(price) || price < 0) throw new Error('外发单价必填');

      const lastOffline = await lastOfflineInBucket('outsource', null, client);

      const onlineTime = lastOffline ? addDaysYmd(lastOffline, 1) : addDaysYmd(today, 1);

      const offlineTime = addDaysYmd(onlineTime, requiredDays);

      const sortOrder = await nextSortOrder('outsource', null, client);

      const avgDaily = Math.max(50, Math.round(scheduleQty / requiredDays));



      zonePatch = {

        scheduling_zone: 'outsource',

        group_name: null,

        is_outsourced: true,

        outsourced_factory: factory,

        outsourced_price: price,

        required_days: requiredDays,

        online_time: onlineTime,

        offline_time: offlineTime,

        scheduled_output: scheduleQty,

        avg_daily_output: avgDaily,

        sort_order: sortOrder,

      };

    } else {

      const groupName = String(input.group_name ?? '').trim();

      if (!isProductionGroup(groupName)) throw new Error('请选择有效排入组别');

      const lastOffline = await lastOfflineInBucket('group', groupName, client);

      const onlineTime = lastOffline ? addDaysYmd(lastOffline, 1) : addDaysYmd(today, 1);

      const offlineTime = addDaysYmd(onlineTime, requiredDays);

      const sortOrder = await nextSortOrder('group', groupName, client);

      const avgDaily = Math.max(50, Math.round(scheduleQty / requiredDays));



      zonePatch = {

        scheduling_zone: 'group',

        group_name: groupName,

        is_outsourced: false,

        outsourced_factory: null,

        outsourced_price: null,

        required_days: requiredDays,

        online_time: onlineTime,

        offline_time: offlineTime,

        scheduled_output: scheduleQty,

        avg_daily_output: avgDaily,

        sort_order: sortOrder,

      };

    }



    const remarks = input.scheduling_remarks?.trim();

    const childRow = buildChildRowFromParent(parent, {

      ...zonePatch,

      scheduling_remarks: remarks || null,

    });



    const keys = Object.keys(childRow);

    const values = keys.map((k) => childRow[k]);

    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const insertRes = await client.query(

      `INSERT INTO styles (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,

      values,

    );



    const diff = { parent_id: { old: null, new: id }, ...zonePatch };

    await client.query(

      'INSERT INTO style_histories (style_id, changed_data, changed_by) VALUES ($1, $2, $3)',

      [insertRes.rows[0].id, JSON.stringify(diff), changedBy],

    );



    await client.query('COMMIT');

    return enrichStyle(insertRes.rows[0] as StyleRow);

  } catch (e) {

    await client.query('ROLLBACK');

    throw e;

  } finally {

    client.release();

  }

}


