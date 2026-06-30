import { getClient } from '../config/database.js';
import { loadAllExceptionsMap } from './calendarExceptionService.js';
import {
  loadGroupOrders,
  recalcProductionGroup,
  type GroupOrderRow,
} from './schedulingTimeline.js';
import { todayYmd, toYmd } from '../utils/schedulingZone.js';

export interface CalendarSchedulingRecalcResult {
  groupsRecalculated: number;
}

function sortGroupOrders(orders: GroupOrderRow[]): GroupOrderRow[] {
  return [...orders].sort((a, b) => {
    const sa = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const sb = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return a.id - b.id;
  });
}

/** 假期/补班变更后：重算全部生产组排期（首单保留原上线日，required_days 不变） */
export async function recalcAllProductionGroupsAfterCalendarChange(
  changedBy = 'calendar-change',
): Promise<CalendarSchedulingRecalcResult> {
  const exceptions = await loadAllExceptionsMap();
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const groupsRes = await client.query<{ group_name: string }>(
      `SELECT DISTINCT group_name FROM styles
       WHERE scheduling_zone = 'group' AND group_name IS NOT NULL AND group_name <> ''
       ORDER BY group_name`,
    );

    for (const { group_name: groupName } of groupsRes.rows) {
      const orders = await loadGroupOrders(groupName, client);
      if (orders.length === 0) continue;

      const sorted = sortGroupOrders(orders);
      const firstOnline = toYmd(sorted[0].online_time) ?? todayYmd();

      await recalcProductionGroup(
        groupName,
        client,
        exceptions,
        changedBy,
        0,
        { firstOnlineAt: firstOnline },
        'calendar-change',
      );
    }

    await client.query('COMMIT');
    return { groupsRecalculated: groupsRes.rows.length };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
