import type { StyleRecord } from '@/types/style';
import { isAwaitingSchedule } from '@/utils/schedulingRules';

export function calcDays(online?: string | null, offline?: string | null): number | null {
  if (!online || !offline) return null;
  const a = new Date(online);
  const b = new Date(offline);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function enrichStyleClient(row: StyleRecord): StyleRecord {
  const days = calcDays(row.online_time, row.offline_time);
  const output_ratio = row.avg_daily_output
    ? Math.round(((row.scheduled_output ?? 0) / row.avg_daily_output) * 100) / 100
    : null;
  const isChild = row.parent_style_id != null;
  const processing_output_value = isChild
    ? null
    : row.quantity != null && row.processing_unit_price != null
      ? Math.round(row.quantity * row.processing_unit_price * 100) / 100
      : null;
  const sales_output_value = isChild
    ? null
    : row.quantity != null && row.sales_price != null
      ? Math.round(row.quantity * row.sales_price * 100) / 100
      : null;
  return { ...row, days, output_ratio, processing_output_value, sales_output_value };
}

export function isUnscheduled(row: StyleRecord): boolean {
  return isAwaitingSchedule(row);
}

/** 下线日晚于要求出货日 */
export function isOfflineAfterShipping(row: StyleRecord): boolean {
  const ship = row.required_shipping_date ? String(row.required_shipping_date).slice(0, 10) : null;
  const offline = row.offline_time ? String(row.offline_time).slice(0, 10) : null;
  if (!ship || !offline) return false;
  return offline > ship;
}

export function formatMoney(v?: number | null): string {
  if (v == null || Number.isNaN(v)) return '—';
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(v?: string | null): string {
  if (!v) return '—';
  return String(v).slice(0, 10);
}
