import { isAwaitingSchedule } from '../services/styleAllocation.js';
import type { CalendarExceptionMap } from './businessDays.js';
import { countNonWorkdaysInScheduleSpan } from './businessDays.js';
import { toYmdBeijing } from './beijingTime.js';

export interface StyleRow {
  id?: number;
  online_time?: string | Date | null;
  offline_time?: string | Date | null;
  scheduled_output?: number | null;
  avg_daily_output?: number | null;
  quantity?: number | null;
  processing_unit_price?: number | null;
  sales_price?: number | null;
  [key: string]: unknown;
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
  const sales_output_value = isChild
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
  return isAwaitingSchedule(row as StyleRow & {
    parent_style_id?: unknown;
    scheduling_zone?: string | null;
    group_name?: string | null;
    unscheduled_quantity?: number;
  });
}

export const EDITABLE_STYLE_FIELDS = [
  'salesperson', 'brand', 'style_number', 'style_name', 'closing_month', 'style_image',
  'fabric_structure', 'fabric_readiness', 'accessories_readiness', 'sample_progress',
  'first_bed_time', 'po_number', 'online_time', 'offline_time', 'scheduled_output',
  'avg_daily_output', 'group_name', 'short_over_shipment', 'quantity', 'processing_unit_price',
  'sales_price', 'printing_embroidery', 'order_follower', 'required_shipping_date', 'remarks',
  'is_outsourced', 'outsourced_factory', 'overseas_merchandiser', 'outsourced_price',
  'scheduling_zone', 'sort_order', 'required_days', 'parent_style_id', 'scheduling_remarks',
] as const;
