import type { StyleRecord } from '@/types/style';
import { STYLE_FIELD_LABELS } from '@/types/style';
import { todayYmd } from '@/utils/beijingTime';
import { EARLY_WARNING_COLUMNS } from '@/utils/schedulingColumnPrefs';
import type { ColumnPreferences } from '@/utils/quotationListColumnPrefs';
import type { ClosingMonthRange } from '@/utils/closingMonthRange';
import type { FieldFilterState } from '@/utils/earlyWarningFieldFilter';
import type { EarlyWarningSearchScope } from '@/utils/schedulingFilters';
import { STYLE_DATE_FIELD_KEYS, toYmdBeijingClient } from '@/utils/styleCalculations';

const EXPORT_EXCLUDED = new Set(['action', 'row_edit', 'move_target']);

export function filterExportColumnKeys(keys: string[]): string[] {
  return keys.filter((k) => k && !EXPORT_EXCLUDED.has(k));
}

/** 模板列顺序 ∩ 用户勾选；未在模板中的勾选字段追加到末尾 */
export function resolveExportColumns(
  templateConfig: { columns?: { key: string }[] } | null | undefined,
  userSelectedKeys: string[],
): { keys: string[]; unconfigured: string[] } {
  const selected = filterExportColumnKeys(userSelectedKeys);
  if (!selected.length) return { keys: [], unconfigured: [] };
  if (!templateConfig?.columns?.length) {
    return { keys: selected, unconfigured: [] };
  }
  const selectedSet = new Set(selected);
  const templateKeys = templateConfig.columns.map((c) => c.key);
  const templateSet = new Set(templateKeys);
  const inTemplate = templateKeys.filter((k) => selectedSet.has(k));
  const unconfigured = selected.filter((k) => !templateSet.has(k));
  return { keys: [...inTemplate, ...unconfigured], unconfigured };
}

export function getExportFieldLabel(key: string): string {
  return EXPORT_TITLES[key] || key;
}

const EXPORT_TITLES: Record<string, string> = Object.fromEntries(
  EARLY_WARNING_COLUMNS.map((c) => {
    if (c.key === 'processing_output_value') return [c.key, '加工产值（万美金）'];
    if (c.key === 'sales_output_value') return [c.key, '销售产值（万元）'];
    return [c.key, c.title];
  }),
);

const EXPORT_KEYS = EARLY_WARNING_COLUMNS.filter((c) => !EXPORT_EXCLUDED.has(c.key)).map((c) => c.key);

export const EXPORT_COLUMN_OPTIONS = EARLY_WARNING_COLUMNS
  .filter((c) => !EXPORT_EXCLUDED.has(c.key))
  .map((c) => ({
    key: c.key,
    label: EXPORT_TITLES[c.key] || c.title,
  }));

export function getDefaultExportColumnKeys(prefs: ColumnPreferences): string[] {
  return prefs.order.filter(
    (key) => !EXPORT_EXCLUDED.has(key) && prefs.visible[key] !== false,
  );
}

export interface EarlyWarningExportMetaInput {
  exportUser: string;
  exportTime: string;
  searchScope: EarlyWarningSearchScope;
  searchKeyword: string;
  closingMonthRange: ClosingMonthRange;
  fieldFilter: FieldFilterState | null;
  unscheduledOnly: boolean;
  exportMode: 'selected' | 'filtered';
  rowCount: number;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}

export function buildEarlyWarningExportMeta(input: EarlyWarningExportMetaInput) {
  const sortCol = input.sortField
    ? EARLY_WARNING_COLUMNS.find((c) => c.key === input.sortField)
    : undefined;
  const fieldLabel = input.fieldFilter
    ? (STYLE_FIELD_LABELS[input.fieldFilter.field] ?? input.fieldFilter.field)
    : undefined;

  return {
    export_user: input.exportUser,
    export_time: input.exportTime,
    search_scope: input.searchScope,
    search_keyword: input.searchKeyword,
    closing_month_start: input.closingMonthRange.startMonth,
    closing_month_end: input.closingMonthRange.endMonth,
    field_filter_field: input.fieldFilter?.field,
    field_filter_label: fieldLabel,
    field_filter_values: input.fieldFilter?.values,
    unscheduled_only: input.unscheduledOnly,
    export_mode: input.exportMode,
    row_count: input.rowCount,
    sort_field: input.sortField,
    sort_label: sortCol?.title,
    sort_order: input.sortOrder,
  };
}

export function downloadBlob(data: Blob, filename: string) {
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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
