import { isAwaitingSchedule } from '../services/styleAllocation.js';
import type { CalendarExceptionMap } from './businessDays.js';
import { countNonWorkdaysInScheduleSpan } from './businessDays.js';
import { toYmdBeijing } from './beijingTime.js';
import { isProcessingOrder } from './styleClosingValue.js';

export interface StyleRow {
  id?: number;
  salesperson?: string | null;
  brand?: string | null;
  style_number?: string | null;
  style_name?: string | null;
  closing_month?: string | null;
  style_image?: string | null;
  fabric_structure?: string | null;
  fabric_readiness?: string | null;
  accessories_readiness?: string | null;
  sample_progress?: string | null;
  first_bed_time?: string | Date | null;
  po_number?: string | null;
  online_time?: string | Date | null;
  offline_time?: string | Date | null;
  scheduled_output?: number | null;
  avg_daily_output?: number | null;
  group_name?: string | null;
  short_over_shipment?: string | null;
  quantity?: number | null;
  processing_unit_price?: number | null;
  sales_price?: number | null;
  printing_embroidery?: string | null;
  order_follower?: string | null;
  required_shipping_date?: string | Date | null;
  remarks?: string | null;
  is_outsourced?: boolean | null;
  outsourced_factory?: string | null;
  overseas_merchandiser?: string | null;
  outsourced_price?: number | null;
  scheduling_zone?: string | null;
  sort_order?: number | null;
  required_days?: number | null;
  parent_style_id?: number | null;
  scheduling_remarks?: string | null;
  order_type?: string | null;
  cancelled_quantity?: number | null;
  cancel_revision?: number | null;
  scheduling_ack_revision?: number | null;
  /** enrich 计算字段 */
  days?: number | null;
  output_ratio?: number | null;
  processing_output_value?: number | null;
  sales_output_value?: number | null;
  holiday_days?: number | null;
  allocated_quantity?: number | null;
  unscheduled_quantity?: number | null;
  closing_processing_value?: number | null;
  cancel_pending?: boolean;
}

function toDateOnly(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function calcDays(onlineTime: unknown, offlineTime: unknown): number | null {
  const online = toDateOnly(onlineTime);
  const offline = toDateOnly(offlineTime);
  if (!online || !offline) return null;
  const ms = offline.getTime() - online.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function calcOutputRatio(scheduledOutput: unknown, avgDailyOutput: unknown): number | null {
  const scheduled = Number(scheduledOutput);
  const avg = Number(avgDailyOutput);
  if (!Number.isFinite(scheduled) || !Number.isFinite(avg) || avg === 0) return null;
  return Math.round((scheduled / avg) * 100) / 100;
}

export function calcProcessingOutputValue(quantity: unknown, unitPrice: unknown): number | null {
  const q = Number(quantity);
  const p = Number(unitPrice);
  if (!Number.isFinite(q) || !Number.isFinite(p)) return null;
  return Math.round(q * p * 100) / 100;
}

export function calcSalesOutputValue(quantity: unknown, salesPrice: unknown): number | null {
  const q = Number(quantity);
  const p = Number(salesPrice);
  if (!Number.isFinite(q) || !Number.isFinite(p)) return null;
  return Math.round(q * p * 100) / 100;
}

export function enrichStyle(row: StyleRow): StyleRow {
  const days = calcDays(row.online_time, row.offline_time);
  const output_ratio = calcOutputRatio(row.scheduled_output, row.avg_daily_output);
  const isChild = row.parent_style_id != null;
  const processing_output_value = isChild
    ? null
    : calcProcessingOutputValue(row.quantity, row.processing_unit_price);
  const sales_output_value = isChild || isProcessingOrder(row)
    ? null
    : calcSalesOutputValue(row.quantity, row.sales_price);
  return {
    ...row,
    days,
    output_ratio,
    processing_output_value,
    sales_output_value,
  };
}

/** 排单列表：附加假期天数（[online, offline] 内非工作日，含上线/下线当天） */
export function enrichStyleForScheduling(
  row: StyleRow,
  exceptions: CalendarExceptionMap,
): StyleRow {
  const base = enrichStyle(row);
  const online = toYmdBeijing(row.online_time);
  const offline = toYmdBeijing(row.offline_time);
  const holiday_days = online && offline
    ? countNonWorkdaysInScheduleSpan(online, offline, exceptions)
    : null;
  return { ...base, holiday_days };
}

export function isUnscheduled(row: StyleRow): boolean {
  return isAwaitingSchedule(row);
}

export const EDITABLE_STYLE_FIELDS = [
  'salesperson', 'brand', 'style_number', 'style_name', 'closing_month', 'style_image',
  'fabric_structure', 'fabric_readiness', 'accessories_readiness', 'sample_progress',
  'first_bed_time', 'po_number', 'online_time', 'offline_time', 'scheduled_output',
  'avg_daily_output', 'group_name', 'short_over_shipment', 'quantity', 'processing_unit_price',
  'sales_price', 'printing_embroidery', 'order_follower', 'required_shipping_date', 'remarks',
  'is_outsourced', 'outsourced_factory', 'overseas_merchandiser', 'outsourced_price',
  'scheduling_zone', 'sort_order', 'required_days', 'parent_style_id', 'scheduling_remarks',
  'order_type',
] as const;
