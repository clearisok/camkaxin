export const QUOTATION_LIST_COLUMN_STORAGE_KEY = 'jiankai-quotation-list-columns';

export const COLUMN_WIDTH_MIN = 48;
export const COLUMN_WIDTH_MAX = 480;

export interface ColumnPrefItem {
  key: string;
  title: string;
  hideable?: boolean;
  defaultWidth: number;
}

export const QUOTATION_LIST_COLUMN_DEFS: ColumnPrefItem[] = [
  { key: 'list_style_image', title: '款式图', defaultWidth: 72 },
  { key: 'quotation_no', title: '报价单号', defaultWidth: 150 },
  { key: 'product_codes', title: '款号', defaultWidth: 140 },
  { key: 'total_quantity', title: '数量', defaultWidth: 80 },
  { key: 'brand_name', title: '品牌', defaultWidth: 110 },
  { key: 'agent_name', title: '业务员', defaultWidth: 90 },
  { key: 'quote_date', title: '报价日期', defaultWidth: 110 },
  { key: 'currency', title: '币种', defaultWidth: 70 },
  { key: 'fabric_total', title: '面料价格', defaultWidth: 100 },
  { key: 'accessory_total', title: '辅料价格', defaultWidth: 100 },
  { key: 'labor_rmb', title: '工价', defaultWidth: 90 },
  { key: 'status', title: '状态', defaultWidth: 90 },
  { key: 'action', title: '操作', hideable: false, defaultWidth: 168 },
];

export const DEFAULT_COLUMN_ORDER = QUOTATION_LIST_COLUMN_DEFS.map((c) => c.key);

export type ColumnVisibility = Record<string, boolean>;
export type ColumnWidths = Record<string, number>;

export function defaultColumnVisibility(): ColumnVisibility {
  return Object.fromEntries(QUOTATION_LIST_COLUMN_DEFS.map((c) => [c.key, true]));
}

export function defaultColumnWidths(): ColumnWidths {
  return Object.fromEntries(QUOTATION_LIST_COLUMN_DEFS.map((c) => [c.key, c.defaultWidth]));
}

export function clampColumnWidth(width: unknown, fallback: number): number {
  const n = typeof width === 'number' ? width : Number(width);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(COLUMN_WIDTH_MAX, Math.max(COLUMN_WIDTH_MIN, Math.round(n)));
}

/** 解析列宽：优先用户偏好，其次列定义，最后 fallback */
export function resolveColumnWidth(
  key: string,
  colWidth: number | undefined,
  widths: Record<string, number>,
  fallback = 120,
): number {
  if (widths[key] != null) return widths[key];
  if (typeof colWidth === 'number') return colWidth;
  return fallback;
}

/** 锁定列宽，避免 table 填满容器时其他列被连带缩放 */
export function lockedColumnWidthStyle(width: number): { width: number; minWidth: number; maxWidth: number } {
  return { width, minWidth: width, maxWidth: width };
}

export interface ColumnPreferences {
  order: string[];
  visible: ColumnVisibility;
  widths: ColumnWidths;
}

export function normalizeColumnPreferencesForDefs(
  raw: Partial<ColumnPreferences> | null,
  defs: ColumnPrefItem[],
): ColumnPreferences {
  const known = new Set(defs.map((c) => c.key));
  const defaultOrder = defs.map((c) => c.key);
  const order: string[] = [];
  for (const key of raw?.order ?? []) {
    if (known.has(key) && !order.includes(key)) order.push(key);
  }
  for (const key of defaultOrder) {
    if (!order.includes(key)) order.push(key);
  }

  const visible = Object.fromEntries(defs.map((c) => [c.key, true]));
  Object.assign(visible, raw?.visible ?? {});
  for (const col of defs) {
    if (col.hideable === false) visible[col.key] = true;
  }

  const defaults = Object.fromEntries(defs.map((c) => [c.key, c.defaultWidth]));
  const widths: ColumnWidths = { ...defaults };
  for (const col of defs) {
    if (raw?.widths && col.key in raw.widths) {
      widths[col.key] = clampColumnWidth(raw.widths[col.key], defaults[col.key]);
    }
  }

  return { order, visible, widths };
}

export function normalizeColumnPreferences(raw: Partial<ColumnPreferences> | null): ColumnPreferences {
  return normalizeColumnPreferencesForDefs(raw, QUOTATION_LIST_COLUMN_DEFS);
}

export function loadColumnPreferences(): ColumnPreferences {
  try {
    const saved = localStorage.getItem(QUOTATION_LIST_COLUMN_STORAGE_KEY);
    if (!saved) return normalizeColumnPreferences(null);
    return normalizeColumnPreferences(JSON.parse(saved) as Partial<ColumnPreferences>);
  } catch {
    return normalizeColumnPreferences(null);
  }
}

export function saveColumnPreferences(prefs: ColumnPreferences) {
  localStorage.setItem(QUOTATION_LIST_COLUMN_STORAGE_KEY, JSON.stringify(prefs));
}
