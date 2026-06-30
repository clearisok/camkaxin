import { STYLE_FIELD_LABELS } from '@/types/style';
import { EARLY_WARNING_COLUMNS } from '@/utils/schedulingColumnPrefs';

const EXCLUDED_FILTER_KEYS = new Set(['style_number', 'style_image', 'action']);

/** 预警界面可自定义筛选的字段（除款号、款式图、操作外全部列） */
export const EARLY_WARNING_FILTER_FIELDS = EARLY_WARNING_COLUMNS
  .map((c) => c.key)
  .filter((key) => !EXCLUDED_FILTER_KEYS.has(key)) as readonly string[];

export type EarlyWarningFilterField = (typeof EARLY_WARNING_FILTER_FIELDS)[number];

export const EARLY_WARNING_FILTER_FIELD_OPTIONS = EARLY_WARNING_FILTER_FIELDS.map((key) => ({
  value: key,
  label: STYLE_FIELD_LABELS[key] ?? key,
}));

export interface FieldFilterState {
  field: EarlyWarningFilterField;
  values: string[];
}

export function isEarlyWarningFilterField(v: string): v is EarlyWarningFilterField {
  return (EARLY_WARNING_FILTER_FIELDS as readonly string[]).includes(v);
}

export function normalizeFieldFilter(raw: unknown): FieldFilterState | null {
  if (!raw || typeof raw !== 'object') return null;
  const { field, values } = raw as { field?: string; values?: unknown };
  if (!field || !isEarlyWarningFilterField(field)) return null;
  if (!Array.isArray(values)) return null;
  const cleaned = values.map(String).filter(Boolean);
  if (cleaned.length === 0) return null;
  return { field, values: cleaned };
}

export const DEFAULT_FIELD_FILTER_FIELD: EarlyWarningFilterField = 'brand';
