import type { ColumnsType } from 'antd/es/table';
import { clampColumnWidth } from '@/utils/quotationListColumnPrefs';

export interface ItemEditorColumnDef {
  key: string;
  defaultWidth: number;
}

export const FABRIC_COLUMN_DEFS: ItemEditorColumnDef[] = [
  { key: 'name', defaultWidth: 180 },
  { key: 'composition', defaultWidth: 120 },
  { key: 'weight', defaultWidth: 100 },
  { key: 'net_width', defaultWidth: 110 },
  { key: 'gross_width', defaultWidth: 110 },
  { key: 'unit', defaultWidth: 90 },
  { key: 'piece_length', defaultWidth: 100 },
  { key: 'wastage', defaultWidth: 80 },
  { key: 'consumption', defaultWidth: 80 },
  { key: 'unit_price', defaultWidth: 90 },
  { key: 'amount', defaultWidth: 80 },
  { key: 'action', defaultWidth: 50 },
];

export const ACCESSORY_COLUMN_DEFS: ItemEditorColumnDef[] = [
  { key: 'name', defaultWidth: 160 },
  { key: 'specification', defaultWidth: 140 },
  { key: 'consumption', defaultWidth: 80 },
  { key: 'wastage', defaultWidth: 80 },
  { key: 'unit_price', defaultWidth: 90 },
  { key: 'amount', defaultWidth: 80 },
  { key: 'action', defaultWidth: 50 },
];

const FABRIC_STORAGE_KEY = 'jiankai-item-editor-fabric-columns';
const ACCESSORY_STORAGE_KEY = 'jiankai-item-editor-accessory-columns';

export type ItemEditorColumnWidths = Record<string, number>;

function defaultWidths(defs: ItemEditorColumnDef[]): ItemEditorColumnWidths {
  return Object.fromEntries(defs.map((c) => [c.key, c.defaultWidth]));
}

function normalizeWidths(
  defs: ItemEditorColumnDef[],
  raw: ItemEditorColumnWidths | null | undefined
): ItemEditorColumnWidths {
  const defaults = defaultWidths(defs);
  const widths = { ...defaults };
  if (raw) {
    for (const col of defs) {
      if (col.key in raw) {
        widths[col.key] = clampColumnWidth(raw[col.key], defaults[col.key]);
      }
    }
  }
  return widths;
}

export function loadFabricColumnWidths(): ItemEditorColumnWidths {
  try {
    const saved = localStorage.getItem(FABRIC_STORAGE_KEY);
    if (!saved) return defaultWidths(FABRIC_COLUMN_DEFS);
    return normalizeWidths(FABRIC_COLUMN_DEFS, JSON.parse(saved) as ItemEditorColumnWidths);
  } catch {
    return defaultWidths(FABRIC_COLUMN_DEFS);
  }
}

export function saveFabricColumnWidths(widths: ItemEditorColumnWidths) {
  localStorage.setItem(FABRIC_STORAGE_KEY, JSON.stringify(normalizeWidths(FABRIC_COLUMN_DEFS, widths)));
}

export function loadAccessoryColumnWidths(): ItemEditorColumnWidths {
  try {
    const saved = localStorage.getItem(ACCESSORY_STORAGE_KEY);
    if (!saved) return defaultWidths(ACCESSORY_COLUMN_DEFS);
    return normalizeWidths(ACCESSORY_COLUMN_DEFS, JSON.parse(saved) as ItemEditorColumnWidths);
  } catch {
    return defaultWidths(ACCESSORY_COLUMN_DEFS);
  }
}

export function saveAccessoryColumnWidths(widths: ItemEditorColumnWidths) {
  localStorage.setItem(ACCESSORY_STORAGE_KEY, JSON.stringify(normalizeWidths(ACCESSORY_COLUMN_DEFS, widths)));
}

export function estimateItemEditorScrollX<T = unknown>(
  columns: ColumnsType<T>,
  extra = 0
): number {
  return extra + columns.reduce((sum, col) => sum + (typeof col.width === 'number' ? col.width : 120), 0);
}

export function applyItemEditorColumnWidths<T>(
  columns: ColumnsType<T>,
  widths: ItemEditorColumnWidths,
  defs: ItemEditorColumnDef[],
  handlers?: {
    onResize: (key: string, width: number) => void;
    onResizeStop: (key: string, width: number) => void;
  }
): ColumnsType<T> {
  const defaults = defaultWidths(defs);
  return columns.map((col) => {
    const key = String(col.key ?? '');
    const width = widths[key] ?? defaults[key] ?? (typeof col.width === 'number' ? col.width : 120);
    const next = { ...col, width };
    if (!handlers || !key) return next;
    return {
      ...next,
      onHeaderCell: () => ({
        width,
        onResize: (w: number) => handlers.onResize(key, w),
        onResizeStop: (w: number) => handlers.onResizeStop(key, w),
      }),
    };
  });
}
