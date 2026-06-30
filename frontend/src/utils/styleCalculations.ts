import type { StyleRecord } from '@/types/style';
import { isAwaitingSchedule } from '@/utils/schedulingRules';
import { formatDateBeijing, toYmdBeijingClient, STYLE_DATE_FIELD_KEYS } from '@/utils/beijingTime';

export function calcDays(online?: string | null, offline?: string | null): number | null {
  const a = toYmdBeijingClient(online);
  const b = toYmdBeijingClient(offline);
  if (!a || !b) return null;
  const msA = new Date(`${a}T12:00:00+08:00`).getTime();
  const msB = new Date(`${b}T12:00:00+08:00`).getTime();
  return Math.round((msB - msA) / (1000 * 60 * 60 * 24));
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
  const ship = toYmdBeijingClient(row.required_shipping_date);
  const offline = toYmdBeijingClient(row.offline_time);
  if (!ship || !offline) return false;
  return offline > ship;
}

export function formatMoney(v?: number | null): string {
  if (v == null || Number.isNaN(v)) return '—';
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 北京日历日 YYYY-MM-DD */
export function formatDate(v?: string | null): string {
  return formatDateBeijing(v);
}

export { STYLE_DATE_FIELD_KEYS, toYmdBeijingClient };
