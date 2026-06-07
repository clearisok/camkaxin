import type { StyleRecord } from '@/types/style';

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
  const processing_output_value = row.quantity != null && row.processing_unit_price != null
    ? Math.round(row.quantity * row.processing_unit_price * 100) / 100
    : null;
  const sales_output_value = row.quantity != null && row.sales_price != null
    ? Math.round(row.quantity * row.sales_price * 100) / 100
    : null;
  return { ...row, days, output_ratio, processing_output_value, sales_output_value };
}

export function isUnscheduled(row: StyleRecord): boolean {
  return !row.group_name || !row.online_time;
}

export function formatMoney(v?: number | null): string {
  if (v == null || Number.isNaN(v)) return '—';
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(v?: string | null): string {
  if (!v) return '—';
  return String(v).slice(0, 10);
}
