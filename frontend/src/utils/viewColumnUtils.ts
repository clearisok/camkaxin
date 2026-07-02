import type { Dispatch, SetStateAction } from 'react';
import type { ColumnsType } from 'antd/es/table';
import type { ColumnPreferences } from '@/utils/quotationListColumnPrefs';
import { clampColumnWidth, lockedColumnWidthStyle, resolveColumnWidth } from '@/utils/quotationListColumnPrefs';

export interface ColumnResizeHandlers {
  onResize: (key: string, width: number) => void;
  onResizeStop: (key: string, width: number) => void;
}

export interface ApplyViewColumnOptions {
  resizeHandlers?: ColumnResizeHandlers;
  /** 单元格水平对齐；左对齐时缩窄列宽会从右侧裁切，而非两侧向中间挤压 */
  cellAlign?: 'left' | 'center';
  /** 始终置于最前、不参与列设置的列（如行编辑按钮） */
  prependKeys?: string[];
  /** 完全按 prefs.order 排列（含 action、move_target 等），不强制 action 置尾 */
  orderedTrailing?: boolean;
}

function normalizeApplyOptions(
  options?: ColumnResizeHandlers | ApplyViewColumnOptions,
): Required<Pick<ApplyViewColumnOptions, 'cellAlign' | 'prependKeys' | 'orderedTrailing'>> &
  Pick<ApplyViewColumnOptions, 'resizeHandlers'> {
  if (!options) return { cellAlign: 'center', prependKeys: [], orderedTrailing: false };
  if ('onResize' in options) return { resizeHandlers: options, cellAlign: 'center', prependKeys: [], orderedTrailing: false };
  return {
    resizeHandlers: options.resizeHandlers,
    cellAlign: options.cellAlign ?? 'center',
    prependKeys: options.prependKeys ?? [],
    orderedTrailing: options.orderedTrailing ?? false,
  };
}

function attachResizeHandler<T>(
  col: ColumnsType<T>[number],
  key: string,
  widths: Record<string, number>,
  handlers?: ColumnResizeHandlers,
  cellAlign: 'left' | 'center' = 'center',
): ColumnsType<T>[number] {
  const colWidth = resolveColumnWidth(key, col.width as number | undefined, widths);
  const locked = lockedColumnWidthStyle(colWidth);
  const next = {
    align: cellAlign,
    ...col,
    ...locked,
    onCell: () => ({ style: { textAlign: cellAlign, ...locked } }),
  };
  if (!handlers) return next;
  return {
    ...next,
    onHeaderCell: () => ({
      width: colWidth,
      style: { textAlign: cellAlign, ...locked },
      onResize: (w: number) => handlers.onResize(key, w),
      onResizeStop: (w: number) => handlers.onResizeStop(key, w),
    }),
  };
}

export function applyViewColumnPreferences<T>(
  allColumns: ColumnsType<T>,
  prefs: ColumnPreferences,
  options?: ColumnResizeHandlers | ApplyViewColumnOptions,
): ColumnsType<T> {
  const { resizeHandlers, cellAlign, prependKeys, orderedTrailing } = normalizeApplyOptions(options);
  const map = new Map(allColumns.map((col) => [col.key as string, col]));
  const prepended = prependKeys
    .filter((key) => map.has(key))
    .map((key) => attachResizeHandler(map.get(key)!, key, prefs.widths, resizeHandlers, cellAlign));
  if (orderedTrailing) {
    const ordered = prefs.order
      .filter((key) => !prependKeys.includes(key) && prefs.visible[key] !== false && map.has(key))
      .map((key) => attachResizeHandler(map.get(key)!, key, prefs.widths, resizeHandlers, cellAlign));
    return [...prepended, ...ordered];
  }
  const dataCols = prefs.order
    .filter((key) => key !== 'action' && !prependKeys.includes(key) && prefs.visible[key] !== false && map.has(key))
    .map((key) => attachResizeHandler(map.get(key)!, key, prefs.widths, resizeHandlers, cellAlign));
  const actionCol = map.get('action');
  const trailing = actionCol
    ? [attachResizeHandler(actionCol, 'action', prefs.widths, resizeHandlers, cellAlign)]
    : [];
  return [...prepended, ...dataCols, ...trailing];
}

export function estimateScrollX<T = unknown>(columns: ColumnsType<T>, extra = 48): number {
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
