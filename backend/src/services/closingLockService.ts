import { query } from '../config/database.js';
import {
  calcProcessingOutputValue,
  calcSalesOutputValue,
  type StyleRow,
} from '../utils/styleCalculations.js';

export interface ClosingMonthLockRow {
  closing_month: string;
  locked_at: string;
  locked_by: string;
  style_count: number;
  total_sales_output_value: number;
  total_processing_output_value: number;
}

function normalizeClosingMonth(month: string): string {
  const m = String(month ?? '').trim();
  if (!/^\d{4}-\d{2}$/.test(m)) {
    throw new Error('关账月份格式无效，应为 YYYY-MM');
  }
  return m;
}

async function sumMonthOutput(closingMonth: string) {
  const res = await query(
    `SELECT * FROM styles
     WHERE parent_style_id IS NULL AND closing_month = $1`,
    [closingMonth],
  );
  let totalSales = 0;
  let totalProcessing = 0;
  for (const row of res.rows as StyleRow[]) {
    totalSales += calcSalesOutputValue(row.quantity, row.sales_price) ?? 0;
    totalProcessing += calcProcessingOutputValue(row.quantity, row.processing_unit_price) ?? 0;
  }
  return {
    style_count: res.rows.length,
    total_sales_output_value: Math.round(totalSales * 100) / 100,
    total_processing_output_value: Math.round(totalProcessing * 100) / 100,
  };
}

export async function listClosingLocks(): Promise<ClosingMonthLockRow[]> {
  const res = await query(
    `SELECT closing_month, locked_at, locked_by, style_count,
            total_sales_output_value::float, total_processing_output_value::float
     FROM closing_month_locks
     ORDER BY closing_month DESC`,
  );
  return res.rows.map((row) => ({
    closing_month: row.closing_month as string,
    locked_at: String(row.locked_at),
    locked_by: row.locked_by as string,
    style_count: Number(row.style_count),
    total_sales_output_value: Number(row.total_sales_output_value),
    total_processing_output_value: Number(row.total_processing_output_value),
  }));
}

export async function getLockedClosingMonths(): Promise<string[]> {
  const res = await query('SELECT closing_month FROM closing_month_locks');
  return res.rows.map((r) => r.closing_month as string);
}

export async function isClosingMonthLocked(closingMonth: string): Promise<boolean> {
  const month = normalizeClosingMonth(closingMonth);
  const res = await query(
    'SELECT 1 FROM closing_month_locks WHERE closing_month = $1',
    [month],
  );
  return res.rows.length > 0;
}

export async function assertClosingMonthEditable(closingMonth: string | null | undefined): Promise<void> {
  if (!closingMonth) return;
  if (await isClosingMonthLocked(closingMonth)) {
    throw new Error(`${closingMonth} 已关账锁定，不可编辑`);
  }
}

export async function lockClosingMonth(
  closingMonth: string,
  lockedBy = 'system',
): Promise<ClosingMonthLockRow> {
  const month = normalizeClosingMonth(closingMonth);
  const totals = await sumMonthOutput(month);
  if (totals.style_count === 0) {
    throw new Error(`${month} 没有可关账的款式`);
  }
  const existing = await query(
    'SELECT closing_month FROM closing_month_locks WHERE closing_month = $1',
    [month],
  );
  if (existing.rows.length > 0) {
    throw new Error(`${month} 已关账锁定`);
  }

  const res = await query(
    `INSERT INTO closing_month_locks (
      closing_month, locked_by, style_count,
      total_sales_output_value, total_processing_output_value
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING closing_month, locked_at, locked_by, style_count,
              total_sales_output_value::float, total_processing_output_value::float`,
    [
      month,
      lockedBy,
      totals.style_count,
      totals.total_sales_output_value,
      totals.total_processing_output_value,
    ],
  );
  const row = res.rows[0];
  return {
    closing_month: row.closing_month as string,
    locked_at: String(row.locked_at),
    locked_by: row.locked_by as string,
    style_count: Number(row.style_count),
    total_sales_output_value: Number(row.total_sales_output_value),
    total_processing_output_value: Number(row.total_processing_output_value),
  };
}

export async function unlockClosingMonth(closingMonth: string): Promise<void> {
  const month = normalizeClosingMonth(closingMonth);
  const res = await query(
    'DELETE FROM closing_month_locks WHERE closing_month = $1 RETURNING closing_month',
    [month],
  );
  if (res.rows.length === 0) {
    throw new Error(`${month} 未处于关账锁定状态`);
  }
}
