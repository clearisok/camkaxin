import type { ColumnsType } from 'antd/es/table';
import type { ColumnPreferences } from '@/utils/quotationListColumnPrefs';

export function applyViewColumnPreferences<T>(
  allColumns: ColumnsType<T>,
  prefs: ColumnPreferences
): ColumnsType<T> {
  const map = new Map(allColumns.map((col) => [col.key as string, col]));
  const dataCols = prefs.order
    .filter((key) => key !== 'action' && prefs.visible[key] !== false && map.has(key))
    .map((key) => {
      const col = map.get(key)!;
      const width = prefs.widths[key];
      return (width != null ? { ...col, width, align: 'center' as const } : { ...col, align: 'center' as const }) as ColumnsType<T>[number];
    });
  const actionCol = map.get('action');
  return actionCol
    ? [...dataCols, { ...actionCol, width: prefs.widths.action ?? actionCol.width, align: 'center' as const } as ColumnsType<T>[number]]
    : dataCols;
}

export function estimateScrollX(columns: ColumnsType<unknown>, extra = 48): number {
  return extra + columns.reduce((sum, col) => sum + (typeof col.width === 'number' ? col.width : 120), 0);
}
