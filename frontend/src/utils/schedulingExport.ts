import type { StyleRecord } from '@/types/style';
import type { ColumnPreferences } from '@/utils/quotationListColumnPrefs';
import { SCHEDULING_COLUMNS } from '@/utils/schedulingColumnPrefs';
import { ALL_COLLAPSE_KEYS, collapseKeyForRow, collapseLabel, inferZone, ZONE_COLLAPSE_KEYS } from '@/utils/schedulingZone';
import { isAwaitingSchedule } from '@/utils/schedulingRules';
import {
  filterExportColumnKeys,
  resolveExportColumns,
  downloadBlob,
} from '@/utils/earlyWarningExport';

export { filterExportColumnKeys, resolveExportColumns, downloadBlob };

const EXPORT_EXCLUDED = new Set(['action', 'row_edit', 'move_target']);

export const SCHEDULING_ZONE_VIRTUAL_KEY = 'scheduling_zone_label';

const SCHEDULING_TITLES: Record<string, string> = {
  [SCHEDULING_ZONE_VIRTUAL_KEY]: '区位',
  style_number: '款号',
  brand: '品牌',
  style_name: '款式名称',
  salesperson: '业务员',
  po_number: 'PO号',
  quantity: '订单数量',
  required_shipping_date: '要求出货日',
  fabric_readiness: '面辅料进度',
  online_time: '上线时间',
  offline_time: '下线时间',
  required_days: '所需天数',
  holiday_days: '假期天数',
  scheduled_output: '排入数量',
  avg_daily_output: '日均产量',
  scheduling_remarks: '排单备注',
  group_name: '排入组别',
  is_outsourced: '是否外发',
  outsourced_factory: '外发工厂',
  outsourced_price: '外发单价',
  style_image: '款式图',
};

const BASE_KEYS = SCHEDULING_COLUMNS
  .filter((c) => !EXPORT_EXCLUDED.has(c.key))
  .map((c) => c.key);

export const SCHEDULING_EXPORT_COLUMN_OPTIONS = [
  { key: SCHEDULING_ZONE_VIRTUAL_KEY, label: SCHEDULING_TITLES[SCHEDULING_ZONE_VIRTUAL_KEY] },
  ...BASE_KEYS.filter((k) => k !== SCHEDULING_ZONE_VIRTUAL_KEY).map((key) => {
    const col = SCHEDULING_COLUMNS.find((c) => c.key === key);
    return { key, label: SCHEDULING_TITLES[key] || col?.title || key };
  }),
  { key: 'style_image', label: '款式图' },
  { key: 'is_outsourced', label: '是否外发' },
  { key: 'outsourced_factory', label: '外发工厂' },
  { key: 'outsourced_price', label: '外发单价' },
].filter((opt, idx, arr) => arr.findIndex((o) => o.key === opt.key) === idx);

export const SCHEDULING_ZONE_EXPORT_OPTIONS = ALL_COLLAPSE_KEYS
  .filter((key) => key !== 'offline')
  .map((key) => ({
    value: key,
    label: collapseLabel(key, 0).replace(/（0 款）$/, ''),
  }));

/** 排单导出可用行（与页面 collapse 分桶一致：排除下线区；待排单仅含仍有未排数量的母单） */
export function filterRowsForSchedulingExport(rows: StyleRecord[]): StyleRecord[] {
  return rows.filter((row) => {
    if (inferZone(row) === 'offline') return false;
    const key = collapseKeyForRow(row);
    if (key === ZONE_COLLAPSE_KEYS.wait && !isAwaitingSchedule(row)) return false;
    return true;
  });
}

export function getSchedulingExportFieldLabel(key: string): string {
  return SCHEDULING_TITLES[key] || key;
}

export function getDefaultSchedulingExportColumnKeys(prefs: ColumnPreferences): string[] {
  const keys = prefs.order.filter(
    (key) => !EXPORT_EXCLUDED.has(key) && prefs.visible[key] !== false,
  );
  return [SCHEDULING_ZONE_VIRTUAL_KEY, ...keys.filter((k) => k !== SCHEDULING_ZONE_VIRTUAL_KEY)];
}

export function filterRowsByZoneKeys(rows: StyleRecord[], zoneKeys: string[]): StyleRecord[] {
  const exportable = filterRowsForSchedulingExport(rows);
  if (!zoneKeys.length) return exportable;
  const set = new Set(zoneKeys.filter((k) => k !== 'offline'));
  return exportable.filter((row) => {
    const key = collapseKeyForRow(row);
    if (key === ZONE_COLLAPSE_KEYS.wait) return set.has('wait') && isAwaitingSchedule(row);
    return set.has(key);
  });
}

export interface SchedulingExportMetaInput {
  exportUser: string;
  exportTime: string;
  searchKeyword: string;
  exportMode: 'filtered' | 'zones';
  zoneKeys?: string[];
  rowCount: number;
}

export function buildSchedulingExportMeta(input: SchedulingExportMetaInput) {
  return {
    export_user: input.exportUser,
    export_time: input.exportTime,
    search_keyword: input.searchKeyword,
    export_mode: input.exportMode,
    zone_keys: input.zoneKeys,
    zone_labels: input.zoneKeys?.map((k) => collapseLabel(k, 0).replace(/（0 款）$/, '')),
    row_count: input.rowCount,
    sandbox_mode: false,
  };
}
