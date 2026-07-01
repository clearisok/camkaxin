import type { PoolClient } from 'pg';
import { query } from '../config/database.js';
import { inferZoneFromRow } from '../utils/schedulingZone.js';

export async function sumAllocatedQuantity(parentId: number, client?: PoolClient): Promise<number> {
  const run = client ? client.query.bind(client) : query;
  const res = await run<{ sum: string }>(
    `SELECT COALESCE(SUM(scheduled_output), 0)::text AS sum
     FROM styles WHERE parent_style_id = $1`,
    [parentId],
  );
  return parseInt(res.rows[0]?.sum ?? '0', 10);
}

export function calcUnscheduledQuantity(orderQuantity: unknown, allocated: number): number {
  const qty = Number(orderQuantity);
  if (!Number.isFinite(qty) || qty < 0) return 0;
  return Math.max(0, Math.round(qty) - allocated);
}

/** 改造前整行进组、无子单的母单 */
export function isLegacyWholeRowSchedule(row: {
  parent_style_id?: unknown;
  scheduling_zone?: string | null;
  group_name?: string | null;
}): boolean {
  if (row.parent_style_id != null) return false;
  return inferZoneFromRow(row) !== 'wait';
}

/** 子单汇总为 0 时，历史整行排单按母单自身已排量计 */
export function effectiveAllocatedQuantity(
  row: {
    quantity?: unknown;
    scheduled_output?: unknown;
    parent_style_id?: unknown;
    scheduling_zone?: string | null;
    group_name?: string | null;
  },
  childAllocated: number,
): number {
  if (childAllocated > 0) return childAllocated;
  if (!isLegacyWholeRowSchedule(row)) return 0;
  const out = Number(row.scheduled_output);
  const qty = Number(row.quantity);
  if (Number.isFinite(out) && out > 0) return Math.round(out);
  if (Number.isFinite(qty) && qty > 0) return Math.round(qty);
  return 0;
}

/** 待排母单：wait 区 + 无父单 + 仍有未排数量 */
export function isAwaitingSchedule(row: {
  parent_style_id?: unknown;
  scheduling_zone?: string | null;
  group_name?: string | null;
  unscheduled_quantity?: number;
}): boolean {
  if (row.parent_style_id != null) return false;
  if (inferZoneFromRow(row) !== 'wait') return false;
  return (row.unscheduled_quantity ?? 0) > 0;
}

export async function loadAllocatedMap(parentIds: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (parentIds.length === 0) return map;
  const res = await query<{ parent_style_id: string; sum: string }>(
    `SELECT parent_style_id, COALESCE(SUM(scheduled_output), 0)::text AS sum
     FROM styles
     WHERE parent_style_id = ANY($1::int[])
     GROUP BY parent_style_id`,
    [parentIds],
  );
  for (const row of res.rows) {
    map.set(Number(row.parent_style_id), parseInt(row.sum, 10));
  }
  return map;
}

/** 从母单复制到子单的展示/业务字段（产值仍在母单计算） */
export const CHILD_COPY_FIELDS = [
  'salesperson', 'brand', 'style_number', 'style_name', 'closing_month', 'style_image',
  'fabric_structure', 'fabric_readiness', 'accessories_readiness', 'sample_progress',
  'first_bed_time', 'po_number', 'printing_embroidery', 'order_follower',
  'required_shipping_date', 'processing_unit_price', 'sales_price', 'quantity', 'order_type',
] as const;

export function buildChildRowFromParent(
  parent: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const child: Record<string, unknown> = {
    parent_style_id: parent.id,
    scheduling_zone: 'wait',
  };
  for (const key of CHILD_COPY_FIELDS) {
    if (parent[key] !== undefined) child[key] = parent[key];
  }
  return { ...child, ...patch };
}
