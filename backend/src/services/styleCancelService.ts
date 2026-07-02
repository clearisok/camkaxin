import type { PoolClient } from 'pg';
import { getClient, query } from '../config/database.js';
import { assertClosingMonthEditable } from './closingLockService.js';
import { enrichStyle, type StyleRow } from '../utils/styleCalculations.js';
import {
  effectiveAllocatedQuantity,
  loadAllocatedMap,
  sumAllocatedQuantity,
} from './styleAllocation.js';

export interface CancelStyleInput {
  cancel_qty?: number;
  cancel_all?: boolean;
  reason?: string;
}

export function computeCancelPending(
  row: StyleRow & {
    scheduling_ack_revision?: number;
    parent_cancel_revision?: number;
    parent_quantity?: number;
    parent_allocated?: number;
  },
): boolean {
  const parentId = row.parent_style_id != null ? Number(row.parent_style_id) : Number(row.id);
  if (!Number.isFinite(parentId)) return false;

  if (row.parent_style_id != null) {
    const ack = Number(row.scheduling_ack_revision ?? 0);
    const rev = Number(row.parent_cancel_revision ?? 0);
    if (ack < rev) return true;
  }

  const parentQty = row.parent_style_id != null
    ? Number(row.parent_quantity ?? 0)
    : Number(row.quantity ?? 0);
  const allocated = row.parent_style_id != null
    ? Number(row.parent_allocated ?? 0)
    : Number(row.allocated_quantity ?? row.parent_allocated ?? 0);

  if (Number.isFinite(allocated) && Number.isFinite(parentQty) && allocated > parentQty) {
    return true;
  }
  return false;
}

/** 排单保存后：同母单下所有款式对齐 cancel_revision */
export async function acknowledgeCancelForParent(
  parentId: number,
  client?: PoolClient,
): Promise<void> {
  const run = client ? client.query.bind(client) : query;
  const parentRes = await run<{ cancel_revision: number }>(
    'SELECT cancel_revision FROM styles WHERE id = $1',
    [parentId],
  );
  const rev = parentRes.rows[0]?.cancel_revision ?? 0;
  await run(
    `UPDATE styles SET scheduling_ack_revision = $1, updated_at = NOW()
     WHERE id = $2 OR parent_style_id = $2`,
    [rev, parentId],
  );
}

export async function resolveParentId(styleId: number, client?: PoolClient): Promise<number> {
  const run = client ? client.query.bind(client) : query;
  const res = await run<{ id: number; parent_style_id: number | null }>(
    'SELECT id, parent_style_id FROM styles WHERE id = $1',
    [styleId],
  );
  const row = res.rows[0];
  if (!row) throw new Error('款式不存在');
  return row.parent_style_id != null ? Number(row.parent_style_id) : Number(row.id);
}

export async function cancelStyleOrder(
  id: number,
  input: CancelStyleInput,
  changedBy = 'cancel-order',
): Promise<StyleRow & { cancel_pending?: boolean }> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const res = await client.query('SELECT * FROM styles WHERE id = $1 FOR UPDATE', [id]);
    const row = res.rows[0] as Record<string, unknown> | undefined;
    if (!row) throw new Error('款式不存在');
    if (row.parent_style_id != null) throw new Error('只能对订单母单执行取消');

    await assertClosingMonthEditable(row.closing_month as string | null);

    const currentQty = Number(row.quantity);
    if (!Number.isFinite(currentQty) || currentQty < 1) {
      throw new Error('当前订单数量无效，无法取消');
    }

    let cancelQty: number;
    if (input.cancel_all) {
      cancelQty = currentQty;
    } else {
      cancelQty = Number(input.cancel_qty);
      if (!Number.isFinite(cancelQty) || !Number.isInteger(cancelQty) || cancelQty < 1) {
        throw new Error('取消数量须为正整数');
      }
      if (cancelQty > currentQty) {
        throw new Error(`取消数量不能超过当前数量（${currentQty}）`);
      }
    }

    const newQty = currentQty - cancelQty;
    const newCancelled = Number(row.cancelled_quantity ?? 0) + cancelQty;
    const newRevision = Number(row.cancel_revision ?? 0) + 1;

    const diff = {
      quantity: { old: currentQty, new: newQty },
      cancelled_quantity: { old: row.cancelled_quantity ?? 0, new: newCancelled },
      cancel_revision: { old: row.cancel_revision ?? 0, new: newRevision },
    };

    await client.query(
      `UPDATE styles SET
        quantity = $1,
        cancelled_quantity = $2,
        cancel_revision = $3,
        updated_at = NOW()
       WHERE id = $4`,
      [newQty, newCancelled, newRevision, id],
    );

    await client.query(
      'INSERT INTO style_histories (style_id, changed_data, changed_by) VALUES ($1, $2, $3)',
      [id, JSON.stringify(diff), changedBy],
    );

    await client.query('COMMIT');

    const updated = await getStyleWithCancelFlags(id);
    return updated!;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function getStyleWithCancelFlags(id: number): Promise<(StyleRow & {
  cancel_pending?: boolean;
  allocated_quantity?: number;
  unscheduled_quantity?: number;
}) | null> {
  const res = await query('SELECT * FROM styles WHERE id = $1', [id]);
  if (!res.rows[0]) return null;
  const row = enrichStyle(res.rows[0] as StyleRow);
  if (row.parent_style_id != null) return row;

  const childAllocated = await sumAllocatedQuantity(id);
  const allocated = effectiveAllocatedQuantity(row, childAllocated);
  const enriched = {
    ...row,
    allocated_quantity: allocated,
    unscheduled_quantity: Math.max(0, Math.round(Number(row.quantity ?? 0) - allocated)),
  };
  return {
    ...enriched,
    cancel_pending: computeCancelPending({
      ...enriched,
      parent_allocated: allocated,
      parent_quantity: enriched.quantity ?? undefined,
      parent_cancel_revision: enriched.cancel_revision ?? undefined,
    }),
  };
}

/** 排单列表：附加取消待处理标记 */
export async function enrichRowsWithCancelFlags(rows: StyleRow[]): Promise<Array<StyleRow & {
  cancel_pending?: boolean;
  parent_cancel_revision?: number;
  parent_quantity?: number;
  parent_allocated?: number;
}>> {
  const parentIds = new Set<number>();
  for (const row of rows) {
    if (row.parent_style_id != null) parentIds.add(Number(row.parent_style_id));
    else parentIds.add(Number(row.id));
  }
  const ids = [...parentIds].filter((id) => Number.isFinite(id));
  if (ids.length === 0) return rows;

  const parentRes = await query(
    'SELECT id, quantity, cancel_revision FROM styles WHERE id = ANY($1::int[])',
    [ids],
  );
  const parentMap = new Map<number, { quantity: number; cancel_revision: number }>();
  for (const p of parentRes.rows) {
    parentMap.set(Number(p.id), {
      quantity: Number(p.quantity ?? 0),
      cancel_revision: Number(p.cancel_revision ?? 0),
    });
  }

  const allocatedMap = await loadAllocatedMap(ids);

  return rows.map((row) => {
    const parentId = row.parent_style_id != null
      ? Number(row.parent_style_id)
      : Number(row.id);
    const parent = parentMap.get(parentId);
    const childAllocated = allocatedMap.get(parentId) ?? 0;
    const parentRow = row.parent_style_id == null ? row : null;
    const allocated = parentRow
      ? effectiveAllocatedQuantity(row, childAllocated)
      : childAllocated;

    const enriched = {
      ...row,
      parent_cancel_revision: parent?.cancel_revision ?? 0,
      parent_quantity: parent?.quantity ?? 0,
      parent_allocated: allocated,
    };
    return {
      ...enriched,
      cancel_pending: computeCancelPending(enriched),
    };
  });
}
