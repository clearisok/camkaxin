import type { StyleRecord } from '@/types/style';
import { EARLY_WARNING_COLUMNS } from '@/utils/schedulingColumnPrefs';
const EXPORT_KEYS = EARLY_WARNING_COLUMNS.filter((c) => c.key !== 'action').map((c) => c.key);

const EXPORT_TITLES: Record<string, string> = Object.fromEntries(
  EARLY_WARNING_COLUMNS.map((c) => [c.key, c.title]),
);

function cellValue(row: StyleRecord, key: string): string {
  const v = row[key as keyof StyleRecord];
  if (v == null || v === '') return '';
  if (key === 'processing_output_value') {
    return formatProcessingOutputDisplay(Number(v));
  }
  if (key === 'sales_output_value') {
    return formatSalesOutputDisplay(Number(v));
  }
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
  a.download = filename || `预警导出_${new Date().toISOString().slice(0, 10)}.csv`;
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

/** 加工产值：原值 ÷ 10000，单位万美金 */
export function formatProcessingOutputDisplay(v?: number | null): string {
  if (v == null || Number.isNaN(v)) return '—';
  const scaled = v / 10000;
  return `${scaled.toLocaleString('zh-CN', WAN_FORMAT)} 万美金`;
}

/** 销售产值：原值 ÷ 10000，单位万元 */
export function formatSalesOutputDisplay(v?: number | null): string {
  if (v == null || Number.isNaN(v)) return '—';
  const scaled = v / 10000;
  return `${scaled.toLocaleString('zh-CN', WAN_FORMAT)} 万元`;
}

export function formatSumProcessingOutput(v: number) {
  return formatProcessingOutputDisplay(v);
}

export function formatSumSalesOutput(v: number) {
  return formatSalesOutputDisplay(v);
}
