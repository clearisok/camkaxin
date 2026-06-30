import type { PoolClient } from 'pg';
import { getClient } from '../config/database.js';
import {
  enrichStyle,
  enrichStyleForScheduling,
  type StyleRow,
} from '../utils/styleCalculations.js';
import { loadAllExceptionsMap } from './calendarExceptionService.js';
import {
  calcUnscheduledQuantity,
  effectiveAllocatedQuantity,
  loadAllocatedMap,
} from './styleAllocation.js';
import {
  extendStyleWorkdays,
  moveStyleToTarget,
  offlineStyle,
  outsourceExistingStyle,
  reorderStyleInGroup,
} from './schedulingOperations.js';

export type SandboxOpInput =
  | { type: 'move'; id: number; target: string }
  | { type: 'offline'; id: number }
  | { type: 'reorder'; id: number; direction: 'up' | 'down' }
  | { type: 'outsource'; id: number; payload: {
      outsourced_factory: string;
      outsourced_price?: number | null;
      online_time?: string | null;
      offline_time?: string | null;
      required_days?: number | null;
    } }
  | { type: 'extend'; id: number; extra_workdays: number };

async function fetchSchedulingStyles(client: PoolClient): Promise<StyleRow[]> {
  const result = await client.query(
    `SELECT * FROM styles
     WHERE parent_style_id IS NOT NULL
        OR (parent_style_id IS NULL AND scheduling_zone = 'wait')
        OR (parent_style_id IS NULL AND scheduling_zone NOT IN ('wait'))
     ORDER BY
       CASE scheduling_zone
         WHEN 'wait' THEN 0 WHEN 'group' THEN 1 WHEN 'outsource' THEN 2 WHEN 'offline' THEN 3 ELSE 4
       END,
       group_name ASC NULLS LAST,
       sort_order ASC NULLS LAST,
       online_time ASC NULLS LAST,
       id ASC`,
  );
  const exceptions = await loadAllExceptionsMap();
  const rows = result.rows.map((row) => enrichStyleForScheduling(row as StyleRow, exceptions));
  const parentIds = rows
    .filter((row) => row.parent_style_id == null)
    .map((row) => Number(row.id))
    .filter((id) => Number.isFinite(id));
  const allocatedMap = await loadAllocatedMap(parentIds);
  return rows.map((row) => {
    if (row.parent_style_id != null) return row;
    const childAllocated = allocatedMap.get(Number(row.id)) ?? 0;
    const allocated = effectiveAllocatedQuantity(row, childAllocated);
    return {
      ...row,
      allocated_quantity: allocated,
      unscheduled_quantity: calcUnscheduledQuantity(row.quantity, allocated),
    };
  });
}

async function applySandboxOp(op: SandboxOpInput, client: PoolClient): Promise<void> {
  switch (op.type) {
    case 'move':
      await moveStyleToTarget(op.id, op.target, 'sandbox-preview', client);
      break;
    case 'offline':
      await offlineStyle(op.id, 'sandbox-preview', client);
      break;
    case 'reorder':
      await reorderStyleInGroup(op.id, op.direction, 'sandbox-preview', client);
      break;
    case 'extend':
      await extendStyleWorkdays(op.id, op.extra_workdays, 'sandbox-preview', client);
      break;
    case 'outsource':
      await outsourceExistingStyle(op.id, op.payload, 'sandbox-preview', client);
      break;
    default:
      break;
  }
}

/** 沙箱预览：在事务中应用操作后返回排单列表，最终 ROLLBACK */
export async function previewSandboxScheduling(ops: SandboxOpInput[]): Promise<StyleRow[]> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    for (const op of ops) {
      await applySandboxOp(op, client);
    }
    const rows = await fetchSchedulingStyles(client);
    await client.query('ROLLBACK');
    return rows;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
