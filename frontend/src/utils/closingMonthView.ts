import type { StyleRecord, ClosingOrderStatus } from '@/types/style';
import { isProcessingOrder } from '@/utils/styleCalculations';
import { inferZone } from '@/utils/schedulingZone';

export const CLOSING_ORDER_STATUS_LABELS: Record<ClosingOrderStatus, string> = {
  outsourced: '外发',
  not_online: '未上线',
  online: '已上线',
  offline: '已下线',
};

export const CLOSING_ORDER_STATUS_COLORS: Record<ClosingOrderStatus, string> = {
  outsourced: 'purple',
  not_online: 'default',
  online: 'processing',
  offline: 'success',
};

export function getClosingOrderStatus(row: StyleRecord): ClosingOrderStatus {
  const zone = inferZone(row);
  if (zone === 'offline') return 'offline';
  if (zone === 'outsource' || row.is_outsourced) return 'outsourced';
  if (row.online_time) return 'online';
  return 'not_online';
}

export interface ClosingMonthGroup {
  month: string;
  rows: StyleRecord[];
  totalSales: number;
  totalProcessing: number;
  totalProcessingClosing: number;
}

function rowClosingSalesContribution(row: StyleRecord): number {
  if (isProcessingOrder(row)) {
    return row.closing_processing_value ?? 0;
  }
  return row.sales_output_value ?? 0;
}

export function groupStylesByClosingMonth(rows: StyleRecord[]): ClosingMonthGroup[] {
  const map = new Map<string, StyleRecord[]>();
  for (const row of rows) {
    const month = row.closing_month?.trim() || '未分配';
    const list = map.get(month) ?? [];
    list.push(row);
    map.set(month, list);
  }

  return [...map.entries()]
    .sort(([a], [b]) => {
      if (a === '未分配') return 1;
      if (b === '未分配') return -1;
      return a.localeCompare(b);
    })
    .map(([month, groupRows]) => {
      const sorted = [...groupRows].sort(
        (a, b) => rowClosingSalesContribution(b) - rowClosingSalesContribution(a),
      );
      let totalSales = 0;
      let totalProcessing = 0;
      let totalProcessingClosing = 0;
      for (const r of sorted) {
        if (isProcessingOrder(r)) {
          totalProcessingClosing += r.closing_processing_value ?? 0;
        } else {
          totalSales += r.sales_output_value ?? 0;
        }
        totalProcessing += r.processing_output_value ?? 0;
      }
      return { month, rows: sorted, totalSales, totalProcessing, totalProcessingClosing };
    });
}

export function sumClosingOutput(rows: StyleRecord[]) {
  return rows.reduce(
    (acc, row) => ({
      sales: acc.sales + (isProcessingOrder(row) ? 0 : (row.sales_output_value ?? 0)),
      processing: acc.processing + (row.processing_output_value ?? 0),
      processingClosing: acc.processingClosing + (row.closing_processing_value ?? 0),
    }),
    { sales: 0, processing: 0, processingClosing: 0 },
  );
}

export interface ClosingChartMonthPoint {
  closing_month: string;
  normal_sales: number;
  outsource_sales: number;
  processing_sales: number;
  count: number;
  locked: boolean;
}

function chartPointsFromGroups(groups: ClosingMonthGroup[], locked: boolean): ClosingChartMonthPoint[] {
  return groups
    .filter((g) => g.month !== '未分配')
    .map((g) => {
      let normalSales = 0;
      let outsourceSales = 0;
      let processingSales = 0;
      for (const row of g.rows) {
        if (isProcessingOrder(row)) {
          processingSales += row.closing_processing_value ?? 0;
        } else if (getClosingOrderStatus(row) === 'outsourced') {
          outsourceSales += row.sales_output_value ?? 0;
        } else {
          normalSales += row.sales_output_value ?? 0;
        }
      }
      return {
        closing_month: g.month,
        normal_sales: normalSales,
        outsource_sales: outsourceSales,
        processing_sales: processingSales,
        count: g.rows.length,
        locked,
      };
    });
}

export function buildClosingChartData(
  unlockedGroups: ClosingMonthGroup[],
  lockedGroups: ClosingMonthGroup[] = [],
): ClosingChartMonthPoint[] {
  const unlocked = chartPointsFromGroups(unlockedGroups, false);
  const lockedMonths = new Set(unlocked.map((p) => p.closing_month));
  const locked = chartPointsFromGroups(lockedGroups, true)
    .filter((p) => !lockedMonths.has(p.closing_month));
  return [...unlocked, ...locked].sort((a, b) => a.closing_month.localeCompare(b.closing_month));
}
