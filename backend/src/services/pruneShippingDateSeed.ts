import { query } from '../config/database.js';

/** 种子数据保留的要求出货日范围（含首尾日） */
export const SHIPPING_DATE_RANGE_START = '2026-04-01';
export const SHIPPING_DATE_RANGE_END = '2026-11-30';

export interface PruneShippingDateSeedResult {
  deleted: number;
  kept: number;
  samples: Array<{ id: number; style_number: string | null; required_shipping_date: string | null }>;
}

/**
 * 删除要求出货日不在 2026-04 ~ 2026-11 范围内的款式（种子数据清理，非业务逻辑）
 */
export async function pruneShippingDateSeed(): Promise<PruneShippingDateSeedResult> {
  const preview = await query<{
    id: string;
    style_number: string | null;
    required_shipping_date: string | Date | null;
  }>(
    `SELECT id, style_number, required_shipping_date
     FROM styles
     WHERE required_shipping_date IS NULL
        OR required_shipping_date < $1::date
        OR required_shipping_date > $2::date
     ORDER BY id
     LIMIT 20`,
    [SHIPPING_DATE_RANGE_START, SHIPPING_DATE_RANGE_END],
  );

  const del = await query<{ id: string }>(
    `DELETE FROM styles
     WHERE required_shipping_date IS NULL
        OR required_shipping_date < $1::date
        OR required_shipping_date > $2::date
     RETURNING id`,
    [SHIPPING_DATE_RANGE_START, SHIPPING_DATE_RANGE_END],
  );

  const keptRes = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM styles');

  return {
    deleted: del.rowCount ?? del.rows.length,
    kept: parseInt(keptRes.rows[0]?.count ?? '0', 10),
    samples: preview.rows.map((row) => ({
      id: Number(row.id),
      style_number: row.style_number,
      required_shipping_date: row.required_shipping_date
        ? String(row.required_shipping_date).slice(0, 10)
        : null,
    })),
  };
}
