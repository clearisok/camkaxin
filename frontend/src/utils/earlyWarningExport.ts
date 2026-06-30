import type { StyleRecord } from '@/types/style';
import { todayYmd } from '@/utils/beijingTime';
import { EARLY_WARNING_COLUMNS } from '@/utils/schedulingColumnPrefs';
import { STYLE_DATE_FIELD_KEYS, toYmdBeijingClient } from '@/utils/styleCalculations';

const EXPORT_KEYS = EARLY_WARNING_COLUMNS.filter((c) => c.key !== 'action').map((c) => c.key);

const EXPORT_TITLES: Record<string, string> = Object.fromEntries(
  EARLY_WARNING_COLUMNS.map((c) => {
    if (c.key === 'processing_output_value') return [c.key, '加工产值（万美金）'];
    if (c.key === 'sales_output_value') return [c.key, '销售产值（万元）'];
    return [c.key, c.title];
  }),
);

function cellValue(row: StyleRecord, key: string): string {
  if (key === 'fabric_readiness') {
    const parts = [row.fabric_readiness, row.accessories_readiness].filter(Boolean);
    return parts.join(' / ');
  }
  const v = row[key as keyof StyleRecord];
  if (v == null || v === '') return '';
  if (key === 'processing_output_value') return formatOutputValueNumber(Number(v));
  if (key === 'sales_output_value') return formatOutputValueNumber(Number(v));
  if (STYLE_DATE_FIELD_KEYS.has(key)) return toYmdBeijingClient(v as string);
  if (typeof v === 'boolean') return v ? '是' : '否';
  return String(v);
}

function escapeCsvCell(text: string): string {
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function exportEarlyWarningCsv(rows: StyleRecord[], filename?: string) {
  if (rows.length === 0) return;
  const header = EXPORT_KEYS.map((k) => EXPORT_TITLES[k] || k);
  const lines = [
    header.map(escapeCsvCell).join(','),
    ...rows.map((row) =>
      EXPORT_KEYS.map((k) => escapeCsvCell(cellValue(row, k))).join(','),
    ),
  ];
  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `预警导出_${todayYmd()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function sumOutputValues(rows: StyleRecord[]) {
  return rows.reduce(
    (acc, row) => ({
      processing: acc.processing + (row.processing_output_value ?? 0),
      sales: acc.sales + (row.sales_output_value ?? 0),
    }),
    { processing: 0, sales: 0 },
  );
}

const WAN_FORMAT: Intl.NumberFormatOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

/** 单元格/导出：仅数字，不含单位 */
export function formatOutputValueNumber(v?: number | null): string {
  if (v == null || Number.isNaN(v)) return '—';
  const scaled = v / 10000;
  return scaled.toLocaleString('zh-CN', WAN_FORMAT);
}

/** @deprecated 使用 formatOutputValueNumber；保留兼容 */
export function formatProcessingOutputDisplay(v?: number | null): string {
  return formatOutputValueNumber(v);
}

/** @deprecated 使用 formatOutputValueNumber */
export function formatSalesOutputDisplay(v?: number | null): string {
  return formatOutputValueNumber(v);
}

export function formatSumProcessingOutputNumber(v: number) {
  return formatOutputValueNumber(v);
}

export function formatSumSalesOutputNumber(v: number) {
  return formatOutputValueNumber(v);
}

/** @deprecated */
export function formatSumProcessingOutput(v: number) {
  return formatSumProcessingOutputNumber(v);
}

/** @deprecated */
export function formatSumSalesOutput(v: number) {
  return formatSumSalesOutputNumber(v);
}
