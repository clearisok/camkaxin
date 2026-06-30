import type { PoolClient } from 'pg';
import type { CalendarExceptionMap } from '../utils/businessDays.js';
import {
  countWorkdaysForSchedule,
  nextOnlineAfterOfflineYmd,
  offlineFromOnlineAndWorkdaysYmd,
  subtractBusinessDaysYmd,
} from '../utils/businessDays.js';
import { todayYmd, toYmd } from '../utils/schedulingZone.js';
import { agentDebugLog } from '../utils/agentDebugLog.js';

export interface GroupOrderRow {
  id: number;
  sort_order: number | null;
  required_days: number | null;
  scheduled_output: number | null;
  online_time: string | null;
  offline_time: string | null;
  avg_daily_output: number | null;
}

export interface TimelinePatch {
  online_time: string;
  offline_time: string;
  avg_daily_output: number | null;
}

export function calcAvgDailyOutput(scheduledOutput: number | null, requiredDays: number): number | null {
  if (scheduledOutput == null || !Number.isFinite(scheduledOutput)) return null;
  return Math.max(50, Math.round(scheduledOutput / requiredDays));
}

export interface RecalcOptions {
  /** 重算 startIndex 处订单的上线日（如首单下线后剩余首单=today） */
  firstOnlineAt?: string;
}

export function resolveRequiredDaysForRow(
  row: GroupOrderRow,
  exceptions: CalendarExceptionMap,
): number {
  const parsed = Number(row.required_days);
  if (Number.isFinite(parsed) && parsed >= 1) return Math.round(parsed);

  const online = toYmd(row.online_time);
  const offline = toYmd(row.offline_time);
  if (online && offline && offline >= online) {
    const days = countWorkdaysForSchedule(online, offline, exceptions);
    if (days >= 1) return days;
  }

  throw new Error(`订单 ${row.id} 所需天数无效`);
}

async function backfillMissingRequiredDays(
  orders: GroupOrderRow[],
  client: PoolClient,
  exceptions: CalendarExceptionMap,
  changedBy: string,
): Promise<void> {
  for (const row of orders) {
    const parsed = Number(row.required_days);
    if (Number.isFinite(parsed) && parsed >= 1) continue;

    const resolved = resolveRequiredDaysForRow(row, exceptions);
    await client.query('UPDATE styles SET required_days = $1, updated_at = NOW() WHERE id = $2', [
      resolved,
      row.id,
    ]);
    await client.query(
      'INSERT INTO style_histories (style_id, changed_data, changed_by) VALUES ($1, $2, $3)',
      [row.id, JSON.stringify({ required_days: { old: row.required_days ?? null, new: resolved } }), changedBy],
    );
    row.required_days = resolved;
    // #region agent log
    agentDebugLog(
      'schedulingTimeline.ts:backfillMissingRequiredDays',
      'backfilled required_days from online/offline',
      { styleId: row.id, resolved, online: row.online_time, offline: row.offline_time },
      'H1',
      'post-fix',
    );
    // #endregion
  }
}

/** 按 sort_order 链式重算生产组时间 */
export function recalcGroupTimelineInMemory(
  orders: GroupOrderRow[],
  exceptions: CalendarExceptionMap,
  today: string,
  startIndex = 0,
  options: RecalcOptions = {},
): TimelinePatch[] {
  const sorted = [...orders].sort((a, b) => {
    const sa = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const sb = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return a.id - b.id;
  });

  const patches: TimelinePatch[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i];
    const requiredDays = resolveRequiredDaysForRow(row, exceptions);

    if (i < startIndex) {
      const existingOnline = toYmd(row.online_time);
      const existingOffline = toYmd(row.offline_time);
      if (!existingOnline || !existingOffline) {
        throw new Error(`订单 ${row.id} 缺少上下线时间，无法部分重算`);
      }
      patches.push({
        online_time: existingOnline,
        offline_time: existingOffline,
        avg_daily_output: row.avg_daily_output != null ? Number(row.avg_daily_output) : calcAvgDailyOutput(
          row.scheduled_output != null ? Number(row.scheduled_output) : null,
          requiredDays,
        ),
      });
      continue;
    }

    let online: string;
    if (i === 0) {
      online = options.firstOnlineAt ?? today;
    } else {
      online = nextOnlineAfterOfflineYmd(patches[i - 1].offline_time, exceptions);
    }

    const offline = offlineFromOnlineAndWorkdaysYmd(online, requiredDays, exceptions);
    patches.push({
      online_time: online,
      offline_time: offline,
      avg_daily_output: calcAvgDailyOutput(
        row.scheduled_output != null ? Number(row.scheduled_output) : null,
        requiredDays,
      ),
    });
  }

  return patches;
}

/** 追加到组末尾时计算新单上下线 */
export function calcAppendToGroupTimeline(
  lastOffline: string | null,
  requiredDays: number,
  exceptions: CalendarExceptionMap,
  today: string,
): { online_time: string; offline_time: string } {
  const online = lastOffline
    ? nextOnlineAfterOfflineYmd(lastOffline, exceptions)
    : today;
  const offline = offlineFromOnlineAndWorkdaysYmd(online, requiredDays, exceptions);
  return { online_time: online, offline_time: offline };
}

export interface OutsourceDateInput {
  online_time?: string | null;
  offline_time?: string | null;
  required_days?: number | null;
}

export function resolveOutsourceDates(
  input: OutsourceDateInput,
  exceptions: CalendarExceptionMap,
): { online_time: string; offline_time: string; required_days: number } {
  const online = input.online_time ? toYmd(input.online_time) : null;
  const offline = input.offline_time ? toYmd(input.offline_time) : null;
  const daysRaw = input.required_days != null ? Number(input.required_days) : null;
  const hasDays = daysRaw != null && Number.isFinite(daysRaw) && daysRaw >= 1;

  const filled = [online, offline, hasDays ? daysRaw : null].filter((v) => v != null).length;
  if (filled < 2) {
    throw new Error('外发须填写上线、下线、天数中的至少两项');
  }

  if (online && hasDays && !offline) {
    return {
      online_time: online,
      offline_time: offlineFromOnlineAndWorkdaysYmd(online, daysRaw!, exceptions),
      required_days: daysRaw!,
    };
  }
  if (offline && hasDays && !online) {
    return {
      online_time: subtractBusinessDaysYmd(offline, daysRaw!, exceptions),
      offline_time: offline,
      required_days: daysRaw!,
    };
  }
  if (online && offline && !hasDays) {
    const days = countWorkdaysForSchedule(online, offline, exceptions);
    if (days < 1) throw new Error('外发工期至少 1 个工作日');
    return { online_time: online, offline_time: offline, required_days: days };
  }
  if (online && offline && hasDays) {
    const computed = offlineFromOnlineAndWorkdaysYmd(online, daysRaw!, exceptions);
    if (computed !== offline) {
      throw new Error('外发上线、下线与天数不一致，请核对');
    }
    return { online_time: online, offline_time: offline, required_days: daysRaw! };
  }

  throw new Error('外发日期参数不完整');
}

export async function loadGroupOrders(
  groupName: string,
  client: PoolClient,
): Promise<GroupOrderRow[]> {
  const res = await client.query<GroupOrderRow>(
    `SELECT id, sort_order, required_days, scheduled_output, online_time, offline_time, avg_daily_output
     FROM styles
     WHERE scheduling_zone = 'group' AND group_name = $1
     ORDER BY sort_order ASC NULLS LAST, id ASC`,
    [groupName],
  );
  return res.rows.map((r) => ({
    ...r,
    online_time: toYmd(r.online_time as string | Date | null),
    offline_time: toYmd(r.offline_time as string | Date | null),
  }));
}

export async function applyGroupTimelinePatches(
  orders: GroupOrderRow[],
  patches: TimelinePatch[],
  client: PoolClient,
  changedBy: string,
): Promise<void> {
  const sorted = [...orders].sort((a, b) => {
    const sa = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const sb = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return a.id - b.id;
  });

  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i];
    const patch = patches[i];
    const diff: Record<string, { old: unknown; new: unknown }> = {};
    const fields: Array<keyof TimelinePatch> = ['online_time', 'offline_time', 'avg_daily_output'];
    for (const key of fields) {
      const oldVal = key === 'online_time' ? toYmd(row.online_time) : key === 'offline_time' ? toYmd(row.offline_time) : row.avg_daily_output;
      const newVal = patch[key];
      if (String(oldVal ?? '') !== String(newVal ?? '')) {
        diff[key] = { old: oldVal ?? null, new: newVal ?? null };
      }
    }
    if (Object.keys(diff).length === 0) continue;

    await client.query(
      `UPDATE styles SET online_time = $1, offline_time = $2, avg_daily_output = $3, updated_at = NOW()
       WHERE id = $4`,
      [patch.online_time, patch.offline_time, patch.avg_daily_output, row.id],
    );
    await client.query(
      'INSERT INTO style_histories (style_id, changed_data, changed_by) VALUES ($1, $2, $3)',
      [row.id, JSON.stringify(diff), changedBy],
    );
  }
}

export async function recalcProductionGroup(
  groupName: string,
  client: PoolClient,
  exceptions: CalendarExceptionMap,
  changedBy: string,
  startIndex = 0,
  options: RecalcOptions = {},
  debugContext = 'recalcProductionGroup',
): Promise<void> {
  const detailRes = await client.query(
    `SELECT id, parent_style_id, sort_order, required_days, online_time, offline_time
     FROM styles WHERE scheduling_zone = 'group' AND group_name = $1
     ORDER BY sort_order ASC NULLS LAST, id ASC`,
    [groupName],
  );
  // #region agent log
  agentDebugLog(
    'schedulingTimeline.ts:recalcProductionGroup',
    debugContext,
    { groupName, startIndex, firstOnlineAt: options.firstOnlineAt, orders: detailRes.rows },
    'H5',
  );
  // #endregion
  const orders = await loadGroupOrders(groupName, client);
  if (orders.length === 0) return;
  await backfillMissingRequiredDays(orders, client, exceptions, changedBy);
  const today = todayYmd();
  const patches = recalcGroupTimelineInMemory(orders, exceptions, today, startIndex, options);
  await applyGroupTimelinePatches(orders, patches, client, changedBy);
}

export async function lastOfflineInProductionGroup(
  groupName: string,
  client: PoolClient,
): Promise<string | null> {
  const orders = await loadGroupOrders(groupName, client);
  if (orders.length === 0) return null;
  const sorted = [...orders].sort((a, b) => {
    const sa = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const sb = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return a.id - b.id;
  });
  return toYmd(sorted[sorted.length - 1].offline_time);
}

export async function nextSortOrderInGroup(
  groupName: string,
  client: PoolClient,
): Promise<number> {
  const res = await client.query(
    `SELECT MAX(sort_order) AS max FROM styles
     WHERE scheduling_zone = 'group' AND group_name = $1`,
    [groupName],
  );
  return (res.rows[0]?.max ?? -1) + 1;
}

export async function nextSortOrderInOutsource(client: PoolClient): Promise<number> {
  const res = await client.query(
    `SELECT MAX(sort_order) AS max FROM styles WHERE scheduling_zone = 'outsource'`,
  );
  return (res.rows[0]?.max ?? -1) + 1;
}
