import type { PoolClient } from 'pg';
import { getClient } from '../config/database.js';
import { loadAllExceptionsMap } from './calendarExceptionService.js';
import {
  isOverdueForOfflineNotification,
  countWorkdaysForSchedule,
  offlineFromOnlineAndWorkdaysYmd,
} from '../utils/businessDays.js';
import {
  inferZoneFromRow,
  isProductionGroup,
  todayYmd,
  toYmd,
} from '../utils/schedulingZone.js';
import { enrichStyle } from '../utils/styleCalculations.js';
import type { StyleRow } from '../utils/styleCalculations.js';
import {
  loadGroupOrders,
  nextSortOrderInGroup,
  nextSortOrderInOutsource,
  recalcProductionGroup,
  resolveOutsourceDates,
  calcAppendToGroupTimeline,
  calcAvgDailyOutput,
  resolveRequiredDaysForRow,
  type OutsourceDateInput,
} from './schedulingTimeline.js';
import { query } from '../config/database.js';
import { agentDebugLog } from '../utils/agentDebugLog.js';
import { acknowledgeCancelForParent } from './styleCancelService.js';

export type MoveTarget = 'wait' | 'outsource' | 'offline' | `group:${string}`;

function parseMoveTarget(target: string): {
  zone: 'wait' | 'group' | 'outsource' | 'offline';
  groupName: string | null;
} {
  if (target === 'wait') return { zone: 'wait', groupName: null };
  if (target === 'outsource') return { zone: 'outsource', groupName: null };
  if (target === 'offline') return { zone: 'offline', groupName: null };
  if (target.startsWith('group:')) {
    const g = target.slice(6);
    if (!isProductionGroup(g)) throw new Error('无效的生产组');
    return { zone: 'group', groupName: g };
  }
  throw new Error('无效的调入区位');
}

async function getStyleForUpdate(id: number, client: PoolClient) {
  const res = await client.query('SELECT * FROM styles WHERE id = $1 FOR UPDATE', [id]);
  const row = res.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error('款式不存在');
  return row;
}

async function writeStylePatch(
  id: number,
  patch: Record<string, unknown>,
  existing: Record<string, unknown>,
  client: PoolClient,
  changedBy: string,
) {
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  const diff: Record<string, { old: unknown; new: unknown }> = {};
  for (const [key, val] of Object.entries(patch)) {
    const oldVal = existing[key];
    const oldStr = oldVal instanceof Date ? toYmd(oldVal as Date) : oldVal;
    const newStr = val instanceof Date ? toYmd(val as Date) : val;
    if (String(oldStr ?? '') === String(newStr ?? '')) continue;
    diff[key] = { old: oldVal ?? null, new: val ?? null };
    sets.push(`${key} = $${idx++}`);
    values.push(val);
  }
  if (sets.length === 0) return;
  sets.push('updated_at = NOW()');
  values.push(id);
  await client.query(`UPDATE styles SET ${sets.join(', ')} WHERE id = $${idx}`, values);
  await client.query(
    'INSERT INTO style_histories (style_id, changed_data, changed_by) VALUES ($1, $2, $3)',
    [id, JSON.stringify(diff), changedBy],
  );
  const parentId = existing.parent_style_id != null
    ? Number(existing.parent_style_id)
    : id;
  if (Number.isFinite(parentId)) {
    await acknowledgeCancelForParent(parentId, client);
  }
}

async function renumberGroupSortOrders(groupName: string, client: PoolClient) {
  const orders = await loadGroupOrders(groupName, client);
  for (let i = 0; i < orders.length; i++) {
    if (orders[i].sort_order === i) continue;
    await client.query('UPDATE styles SET sort_order = $1 WHERE id = $2', [i, orders[i].id]);
    orders[i].sort_order = i;
  }
}

function groupIndexOf(orders: Awaited<ReturnType<typeof loadGroupOrders>>, styleId: number) {
  const sorted = [...orders].sort((a, b) => {
    const sa = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const sb = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return a.id - b.id;
  });
  return sorted.findIndex((o) => o.id === styleId);
}

export async function moveStyleToTarget(
  id: number,
  target: string,
  changedBy = 'move-style',
  externalClient?: PoolClient,
) {
  // #region agent log
  agentDebugLog('schedulingOperations.ts:moveStyleToTarget', 'entry', { id, target }, 'H5');
  // #endregion
  const client = externalClient ?? await getClient();
  const ownsClient = !externalClient;
  try {
    if (ownsClient) await client.query('BEGIN');
    const exceptions = await loadAllExceptionsMap();
    const row = await getStyleForUpdate(id, client);
    const sourceZone = inferZoneFromRow(row as { scheduling_zone?: string; group_name?: string | null });
    const sourceGroup = sourceZone === 'group' && row.group_name ? String(row.group_name) : null;
    let removedIdx = -1;
    if (sourceGroup) {
      const ordersBefore = await loadGroupOrders(sourceGroup, client);
      removedIdx = groupIndexOf(ordersBefore, id);
    }

    const { zone, groupName } = parseMoveTarget(target);

    const patch: Record<string, unknown> = { scheduling_zone: zone };

    if (zone === 'group') {
      patch.group_name = groupName;
      patch.is_outsourced = false;
      patch.outsourced_factory = null;
      patch.outsourced_price = null;
      const sortOrder = await nextSortOrderInGroup(groupName!, client);
      patch.sort_order = sortOrder;

      const requiredDays = resolveRequiredDaysForRow(
        {
          id,
          sort_order: row.sort_order != null ? Number(row.sort_order) : null,
          required_days: row.required_days != null ? Number(row.required_days) : null,
          scheduled_output: row.scheduled_output != null ? Number(row.scheduled_output) : null,
          online_time: toYmd(row.online_time as string | Date | null),
          offline_time: toYmd(row.offline_time as string | Date | null),
          avg_daily_output: row.avg_daily_output != null ? Number(row.avg_daily_output) : null,
        },
        exceptions,
      );

      const existingInTarget = await loadGroupOrders(groupName!, client);
      const lastOffline = existingInTarget.length > 0
        ? toYmd(existingInTarget[existingInTarget.length - 1].offline_time)
        : null;
      const { online_time, offline_time } = calcAppendToGroupTimeline(
        lastOffline,
        requiredDays,
        exceptions,
        todayYmd(),
      );
      patch.online_time = online_time;
      patch.offline_time = offline_time;
      patch.required_days = requiredDays;
      const scheduledOutput = row.scheduled_output != null ? Number(row.scheduled_output) : null;
      if (scheduledOutput != null) {
        patch.avg_daily_output = Math.max(50, Math.round(scheduledOutput / requiredDays));
      }
    } else if (zone === 'outsource') {
      throw new Error('请使用「外发」操作并填写外发日期');
    } else if (zone === 'offline') {
      // 仅改区位，保留原信息
    } else {
      patch.group_name = null;
      patch.is_outsourced = false;
      patch.sort_order = null;
      patch.online_time = null;
      patch.offline_time = null;
    }

    await writeStylePatch(id, patch, row, client, changedBy);

    if (sourceGroup && removedIdx >= 0) {
      const remaining = await loadGroupOrders(sourceGroup, client);
      if (remaining.length > 0) {
        await renumberGroupSortOrders(sourceGroup, client);
        if (removedIdx === 0) {
          await recalcProductionGroup(
            sourceGroup,
            client,
            exceptions,
            changedBy,
            0,
            { firstOnlineAt: todayYmd() },
          );
        } else {
          await recalcProductionGroup(sourceGroup, client, exceptions, changedBy, removedIdx);
        }
      }
    }

    if (ownsClient) {
      await client.query('COMMIT');
      const updated = await client.query('SELECT * FROM styles WHERE id = $1', [id]);
      return enrichStyle(updated.rows[0] as StyleRow);
    }
    return enrichStyle(row as StyleRow);
  } catch (e) {
    if (ownsClient) await client.query('ROLLBACK');
    throw e;
  } finally {
    if (ownsClient) client.release();
  }
}

export async function reorderStyleInGroup(
  id: number,
  direction: 'up' | 'down',
  changedBy = 'reorder-style',
  externalClient?: PoolClient,
) {
  // #region agent log
  agentDebugLog('schedulingOperations.ts:reorderStyleInGroup', 'entry', { id, direction }, 'H5');
  // #endregion
  const client = externalClient ?? await getClient();
  const ownsClient = !externalClient;
  try {
    if (ownsClient) await client.query('BEGIN');
    const exceptions = await loadAllExceptionsMap();
    const row = await getStyleForUpdate(id, client);
    const zone = inferZoneFromRow(row as { scheduling_zone?: string; group_name?: string | null });
    if (zone !== 'group') throw new Error('仅生产组订单可调序');
    const groupName = String(row.group_name ?? '');
    if (!isProductionGroup(groupName)) throw new Error('无效生产组');

    const orders = await loadGroupOrders(groupName, client);
    const idx = groupIndexOf(orders, id);
    if (idx < 0) throw new Error('订单不在该组');
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= orders.length) {
      throw new Error(direction === 'up' ? '已在组内首位' : '已在组内末位');
    }

    const sorted = [...orders].sort((a, b) => {
      const sa = a.sort_order ?? Number.MAX_SAFE_INTEGER;
      const sb = b.sort_order ?? Number.MAX_SAFE_INTEGER;
      if (sa !== sb) return sa - sb;
      return a.id - b.id;
    });

    const a = sorted[idx];
    const b = sorted[swapIdx];
    await client.query('UPDATE styles SET sort_order = $1 WHERE id = $2', [b.sort_order, a.id]);
    await client.query('UPDATE styles SET sort_order = $1 WHERE id = $2', [a.sort_order, b.id]);

    const startIndex = Math.min(idx, swapIdx);
    await recalcProductionGroup(groupName, client, exceptions, changedBy, startIndex);

    if (ownsClient) {
      await client.query('COMMIT');
      const updated = await client.query('SELECT * FROM styles WHERE id = $1', [id]);
      return enrichStyle(updated.rows[0] as StyleRow);
    }
    return enrichStyle(row as StyleRow);
  } catch (e) {
    if (ownsClient) await client.query('ROLLBACK');
    throw e;
  } finally {
    if (ownsClient) client.release();
  }
}

export async function offlineStyle(
  id: number,
  changedBy = 'offline-style',
  externalClient?: PoolClient,
) {
  // #region agent log
  agentDebugLog('schedulingOperations.ts:offlineStyle', 'entry', { id }, 'H5');
  // #endregion
  const client = externalClient ?? await getClient();
  const ownsClient = !externalClient;
  try {
    if (ownsClient) await client.query('BEGIN');
    const exceptions = await loadAllExceptionsMap();
    const row = await getStyleForUpdate(id, client);
    const zone = inferZoneFromRow(row as { scheduling_zone?: string; group_name?: string | null });
    if (zone === 'offline') throw new Error('已在下线区');
    if (zone === 'wait') throw new Error('待排单不可直接下线');

    const sourceGroup = zone === 'group' && row.group_name ? String(row.group_name) : null;

    if (sourceGroup) {
      const ordersBefore = await loadGroupOrders(sourceGroup, client);
      const removedIdx = groupIndexOf(ordersBefore, id);
      await writeStylePatch(id, { scheduling_zone: 'offline' }, row, client, changedBy);

      const remaining = await loadGroupOrders(sourceGroup, client);
      if (remaining.length > 0) {
        await renumberGroupSortOrders(sourceGroup, client);
        if (removedIdx === 0) {
          await recalcProductionGroup(
            sourceGroup,
            client,
            exceptions,
            changedBy,
            0,
            { firstOnlineAt: todayYmd() },
          );
        } else if (removedIdx > 0) {
          await recalcProductionGroup(sourceGroup, client, exceptions, changedBy, removedIdx);
        }
      }
    } else {
      await writeStylePatch(id, { scheduling_zone: 'offline' }, row, client, changedBy);
    }

    if (ownsClient) {
      await client.query('COMMIT');
      const updated = await client.query('SELECT * FROM styles WHERE id = $1', [id]);
      return { style: enrichStyle(updated.rows[0] as StyleRow) };
    }
    return { style: enrichStyle(row as StyleRow) };
  } catch (e) {
    if (ownsClient) await client.query('ROLLBACK');
    throw e;
  } finally {
    if (ownsClient) client.release();
  }
}

export async function extendStyleWorkdays(
  id: number,
  extraWorkdays: number,
  changedBy = 'extend-style',
  externalClient?: PoolClient,
) {
  const client = externalClient ?? await getClient();
  const ownsClient = !externalClient;
  try {
    if (ownsClient) await client.query('BEGIN');
    const exceptions = await loadAllExceptionsMap();
    const row = await getStyleForUpdate(id, client);
    const zone = inferZoneFromRow(row as { scheduling_zone?: string; group_name?: string | null });
    if (zone !== 'group') throw new Error('仅生产组订单可加天');

    const extra = Number(extraWorkdays);
    if (!Number.isFinite(extra) || !Number.isInteger(extra) || extra < 1) {
      throw new Error('加天须为正整数');
    }

    const requiredDays = resolveRequiredDaysForRow(
      {
        id,
        sort_order: row.sort_order != null ? Number(row.sort_order) : null,
        required_days: row.required_days != null ? Number(row.required_days) : null,
        scheduled_output: row.scheduled_output != null ? Number(row.scheduled_output) : null,
        online_time: toYmd(row.online_time as string | Date | null),
        offline_time: toYmd(row.offline_time as string | Date | null),
        avg_daily_output: row.avg_daily_output != null ? Number(row.avg_daily_output) : null,
      },
      exceptions,
    );

    const newRequiredDays = requiredDays + extra;
    const scheduledOutput = row.scheduled_output != null ? Number(row.scheduled_output) : null;
    const patch: Record<string, unknown> = {
      required_days: newRequiredDays,
      avg_daily_output: scheduledOutput != null
        ? Math.max(50, Math.round(scheduledOutput / newRequiredDays))
        : row.avg_daily_output,
    };

    await writeStylePatch(id, patch, row, client, changedBy);

    const groupName = String(row.group_name ?? '');
    const orders = await loadGroupOrders(groupName, client);
    const idx = groupIndexOf(orders, id);
    const startIndex = idx >= 0 ? idx : 0;
    await recalcProductionGroup(groupName, client, exceptions, changedBy, startIndex);

    if (ownsClient) {
      await client.query('COMMIT');
      const updated = await client.query('SELECT * FROM styles WHERE id = $1', [id]);
      return enrichStyle(updated.rows[0] as StyleRow);
    }
    return enrichStyle(row as StyleRow);
  } catch (e) {
    if (ownsClient) await client.query('ROLLBACK');
    throw e;
  } finally {
    if (ownsClient) client.release();
  }
}

export async function listOfflineNotifications() {
  const exceptions = await loadAllExceptionsMap();
  const today = todayYmd();
  const result = await query(
    `SELECT * FROM styles
     WHERE scheduling_zone = 'group'
       AND offline_time IS NOT NULL
     ORDER BY group_name ASC, sort_order ASC NULLS LAST, id ASC`,
  );

  return result.rows
    .filter((row) => {
      const offline = toYmd(row.offline_time as string | Date);
      return offline && isOverdueForOfflineNotification(offline, today, exceptions);
    })
    .map((row) => enrichStyle(row as StyleRow));
}

export async function batchConfirmOffline(ids: number[], changedBy = 'batch-offline') {
  const results: StyleRow[] = [];
  for (const id of ids) {
    const { style } = await offlineStyle(id, changedBy);
    results.push(style);
  }
  return results;
}

export async function batchExtendWorkdays(
  items: Array<{ id: number; extra_workdays: number }>,
  changedBy = 'batch-extend',
) {
  const results: StyleRow[] = [];
  for (const item of items) {
    results.push(await extendStyleWorkdays(item.id, item.extra_workdays, changedBy));
  }
  return results;
}

export async function previewOutsourceDates(input: OutsourceDateInput) {
  const exceptions = await loadAllExceptionsMap();
  return resolveOutsourceDates(input, exceptions);
}

export async function outsourceExistingStyle(
  id: number,
  input: {
    outsourced_factory: string;
    outsourced_price?: number | null;
    online_time?: string | null;
    offline_time?: string | null;
    required_days?: number | null;
  },
  changedBy = 'outsource-style',
  externalClient?: PoolClient,
) {
  const client = externalClient ?? await getClient();
  const ownsClient = !externalClient;
  try {
    if (ownsClient) await client.query('BEGIN');
    const exceptions = await loadAllExceptionsMap();
    const row = await getStyleForUpdate(id, client);
    const zone = inferZoneFromRow(row as { scheduling_zone?: string; group_name?: string | null });

    const factory = String(input.outsourced_factory ?? '').trim();
    if (!factory) throw new Error('外发工厂必填');

    const dates = resolveOutsourceDates(
      {
        online_time: input.online_time,
        offline_time: input.offline_time,
        required_days: input.required_days,
      },
      exceptions,
    );

    const sourceGroup = zone === 'group' && row.group_name ? String(row.group_name) : null;
    let removedIdx = -1;
    if (sourceGroup) {
      const ordersBefore = await loadGroupOrders(sourceGroup, client);
      removedIdx = groupIndexOf(ordersBefore, id);
    }

    const patch: Record<string, unknown> = {
      scheduling_zone: 'outsource',
      group_name: null,
      is_outsourced: true,
      outsourced_factory: factory,
      online_time: dates.online_time,
      offline_time: dates.offline_time,
      required_days: dates.required_days,
      sort_order: await nextSortOrderInOutsource(client),
    };

    if (input.outsourced_price != null) {
      const price = Number(input.outsourced_price);
      if (!Number.isFinite(price) || price < 0) throw new Error('外发单价无效');
      patch.outsourced_price = price;
    }

    const scheduledOutput = row.scheduled_output != null ? Number(row.scheduled_output) : null;
    if (scheduledOutput != null) {
      patch.avg_daily_output = Math.max(50, Math.round(scheduledOutput / dates.required_days));
    }

    await writeStylePatch(id, patch, row, client, changedBy);

    if (sourceGroup && removedIdx >= 0) {
      const remaining = await loadGroupOrders(sourceGroup, client);
      if (remaining.length > 0) {
        await renumberGroupSortOrders(sourceGroup, client);
        if (removedIdx === 0) {
          await recalcProductionGroup(
            sourceGroup,
            client,
            exceptions,
            changedBy,
            0,
            { firstOnlineAt: todayYmd() },
          );
        } else {
          await recalcProductionGroup(sourceGroup, client, exceptions, changedBy, removedIdx);
        }
      }
    }

    if (ownsClient) {
      await client.query('COMMIT');
      const updated = await client.query('SELECT * FROM styles WHERE id = $1', [id]);
      return enrichStyle(updated.rows[0] as StyleRow);
    }
    return enrichStyle(row as StyleRow);
  } catch (e) {
    if (ownsClient) await client.query('ROLLBACK');
    throw e;
  } finally {
    if (ownsClient) client.release();
  }
}

function resolveTimelineTriple(
  row: Record<string, unknown>,
  data: Record<string, unknown>,
  exceptions: Awaited<ReturnType<typeof loadAllExceptionsMap>>,
): { online_time: string; offline_time: string; required_days: number } {
  const existingOnline = toYmd(row.online_time as string | Date | null);
  const existingOffline = toYmd(row.offline_time as string | Date | null);
  const existingDays = row.required_days != null ? Number(row.required_days) : null;

  if ('required_days' in data && !('offline_time' in data) && !('online_time' in data)) {
    if (!existingOnline) throw new Error('请先设置上线时间');
    const days = Math.round(Number(data.required_days));
    if (!Number.isFinite(days) || days < 1) throw new Error('所需天数须 >= 1');
    return {
      online_time: existingOnline,
      offline_time: offlineFromOnlineAndWorkdaysYmd(existingOnline, days, exceptions),
      required_days: days,
    };
  }

  if ('offline_time' in data && !('required_days' in data) && !('online_time' in data)) {
    if (!existingOnline) throw new Error('请先设置上线时间');
    const offline = toYmd(data.offline_time as string | Date | null);
    if (!offline) throw new Error('下线时间无效');
    if (offline < existingOnline) throw new Error('下线时间不能早于上线时间');
    return {
      online_time: existingOnline,
      offline_time: offline,
      required_days: countWorkdaysForSchedule(existingOnline, offline, exceptions),
    };
  }

  if ('online_time' in data && !('offline_time' in data) && !('required_days' in data)) {
    const online = toYmd(data.online_time as string | Date | null);
    if (!online) throw new Error('上线时间无效');
    const days = existingDays != null && Number.isFinite(existingDays) && existingDays >= 1
      ? Math.round(existingDays)
      : (existingOnline && existingOffline
        ? countWorkdaysForSchedule(existingOnline, existingOffline, exceptions)
        : NaN);
    if (!Number.isFinite(days) || days < 1) throw new Error('请先设置所需天数');
    return {
      online_time: online,
      offline_time: offlineFromOnlineAndWorkdaysYmd(online, days, exceptions),
      required_days: days,
    };
  }

  return resolveOutsourceDates(
    {
      online_time: 'online_time' in data ? (data.online_time as string | null) : existingOnline,
      offline_time: 'offline_time' in data ? (data.offline_time as string | null) : existingOffline,
      required_days: 'required_days' in data ? (data.required_days as number | null) : existingDays,
    },
    exceptions,
  );
}

/** 排单区修改上下线/所需天数：联动计算并顺延同组后续订单 */
export async function updateStyleSchedulingTimeline(
  id: number,
  data: Record<string, unknown>,
  changedBy = 'timeline-edit',
) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const exceptions = await loadAllExceptionsMap();
    const row = await getStyleForUpdate(id, client);
    const zone = inferZoneFromRow(row as { scheduling_zone?: string; group_name?: string | null });

    const triple = resolveTimelineTriple(row, data, exceptions);
    const scheduledOutput = row.scheduled_output != null ? Number(row.scheduled_output) : null;
    const patch: Record<string, unknown> = {
      online_time: triple.online_time,
      offline_time: triple.offline_time,
      required_days: triple.required_days,
      avg_daily_output: calcAvgDailyOutput(scheduledOutput, triple.required_days),
    };

    await writeStylePatch(id, patch, row, client, changedBy);

    if (zone === 'group' && row.group_name) {
      const groupName = String(row.group_name);
      const orders = await loadGroupOrders(groupName, client);
      const idx = groupIndexOf(orders, id);
      if (idx >= 0 && idx < orders.length - 1) {
        await recalcProductionGroup(groupName, client, exceptions, changedBy, idx + 1);
      }
    }

    await client.query('COMMIT');
    const updated = await client.query('SELECT * FROM styles WHERE id = $1', [id]);
    return enrichStyle(updated.rows[0] as StyleRow);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
