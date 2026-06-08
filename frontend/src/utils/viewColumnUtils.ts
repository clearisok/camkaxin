import type { Dispatch, SetStateAction } from 'react';
import type { ColumnsType } from 'antd/es/table';
import type { ColumnPreferences } from '@/utils/quotationListColumnPrefs';
import { clampColumnWidth } from '@/utils/quotationListColumnPrefs';

export interface ColumnResizeHandlers {
  onResize: (key: string, width: number) => void;
  onResizeStop: (key: string, width: number) => void;
}

function withColumnWidth<T>(col: T, key: string, widths: Record<string, number>): T {
  const width = widths[key];
  return width != null ? { ...col, width } : col;
}

function attachResizeHandler<T>(
  col: ColumnsType<T>[number],
  key: string,
  widths: Record<string, number>,
  handlers?: ColumnResizeHandlers,
): ColumnsType<T>[number] {
  const next = {
    align: 'center' as const,
    ...withColumnWidth(col, key, widths),
    onCell: () => ({ style: { textAlign: 'center' as const } }),
  };
  if (!handlers) return next;
  const colWidth = widths[key] ?? (typeof next.width === 'number' ? next.width : undefined);
  return {
    ...next,
    onHeaderCell: () => ({
      width: colWidth,
      onResize: (w: number) => handlers.onResize(key, w),
      onResizeStop: (w: number) => handlers.onResizeStop(key, w),
    }),
  };
}

export function applyViewColumnPreferences<T>(
  allColumns: ColumnsType<T>,
  prefs: ColumnPreferences,
  resizeHandlers?: ColumnResizeHandlers,
): ColumnsType<T> {
  const map = new Map(allColumns.map((col) => [col.key as string, col]));
  const dataCols = prefs.order
    .filter((key) => key !== 'action' && prefs.visible[key] !== false && map.has(key))
    .map((key) => attachResizeHandler(map.get(key)!, key, prefs.widths, resizeHandlers));
  const actionCol = map.get('action');
  return actionCol
    ? [...dataCols, attachResizeHandler(actionCol, 'action', prefs.widths, resizeHandlers)]
    : dataCols;
}

export function estimateScrollX(columns: ColumnsType<unknown>, extra = 48): number {
  return extra + columns.reduce((sum, col) => sum + (typeof col.width === 'number' ? col.width : 120), 0);
}

export function createColumnResizeHandlers(
  defs: Record<string, number>,
  setPrefs: Dispatch<SetStateAction<ColumnPreferences>>,
  normalize: (raw: Partial<ColumnPreferences> | null) => ColumnPreferences,
  persist: (prefs: ColumnPreferences) => void,
) {
  const onResize = (key: string, width: number) => {
    setPrefs((prev) => {
      const fallback = prev.widths[key] ?? defs[key] ?? 120;
      return normalize({
        ...prev,
        widths: { ...prev.widths, [key]: clampColumnWidth(width, fallback) },
      });
    });
  };

  const onResizeStop = (key: string, width: number) => {
    setPrefs((prev) => {
      const fallback = prev.widths[key] ?? defs[key] ?? 120;
      const next = normalize({
        ...prev,
        widths: { ...prev.widths, [key]: clampColumnWidth(width, fallback) },
      });
      persist(next);
      return next;
    });
  };

  return { onResize, onResizeStop };
}
