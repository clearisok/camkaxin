import type { StyleRow } from './styleCalculations.js';

export type OrderType = 'distribution' | 'processing';

export function normalizeOrderType(value: unknown): OrderType {
  return value === 'processing' ? 'processing' : 'distribution';
}

/** 加工单关账计入值（万元 RMB）= 数量 × 加工单价(USD) × 汇率 / 10000 */
export function calcClosingProcessingValue(
  quantity: unknown,
  processingUnitPrice: unknown,
  exchangeRate: number,
): number | null {
  const q = Number(quantity);
  const p = Number(processingUnitPrice);
  if (!Number.isFinite(q) || !Number.isFinite(p) || !Number.isFinite(exchangeRate)) return null;
  if (q <= 0 || p <= 0 || exchangeRate <= 0) return null;
  return Math.round((q * p * exchangeRate) / 10000 * 100) / 100;
}

export function isProcessingOrder(row: StyleRow | { order_type?: unknown }): boolean {
  return normalizeOrderType(row.order_type) === 'processing';
}

export interface ClosingEnrichOptions {
  exchangeRate: number;
  closingIncludeProcessing: boolean;
}

/** 关账视图 enrich：加工单不算销售产值；可选计入加工关账值 */
export function enrichClosingValues(
  row: StyleRow,
  opts: ClosingEnrichOptions,
): StyleRow & { closing_processing_value?: number | null } {
  const isChild = row.parent_style_id != null;
  if (isChild) {
    return { ...row, sales_output_value: null, closing_processing_value: null };
  }

  const processing = isProcessingOrder(row);
  const sales_output_value = processing
    ? null
    : row.quantity != null && row.sales_price != null
      ? Math.round(Number(row.quantity) * Number(row.sales_price) * 100) / 100
      : null;

  const processing_output_value = row.quantity != null && row.processing_unit_price != null
    ? Math.round(Number(row.quantity) * Number(row.processing_unit_price) * 100) / 100
    : null;

  let closing_processing_value: number | null = null;
  if (processing && opts.closingIncludeProcessing) {
    closing_processing_value = calcClosingProcessingValue(
      row.quantity,
      row.processing_unit_price,
      opts.exchangeRate,
    );
  }

  return {
    ...row,
    sales_output_value,
    processing_output_value,
    closing_processing_value,
  };
}
