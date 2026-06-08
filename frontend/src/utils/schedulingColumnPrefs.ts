import type { ColumnPrefItem, ColumnPreferences } from '@/utils/quotationListColumnPrefs';
import { normalizeColumnPreferencesForDefs } from '@/utils/quotationListColumnPrefs';

/** 与款式详情页字段顺序、分组保持一致 */
export const EARLY_WARNING_COLUMNS: ColumnPrefItem[] = [
  { key: 'style_number', title: '款号', defaultWidth: 110 },
  { key: 'brand', title: '品牌', defaultWidth: 100 },
  { key: 'quantity', title: '数量', defaultWidth: 80 },
  { key: 'style_name', title: '款式名称', defaultWidth: 120 },
  { key: 'salesperson', title: '业务员', defaultWidth: 96 },
  { key: 'po_number', title: 'PO号', defaultWidth: 110 },
  { key: 'required_shipping_date', title: '要求出货日', defaultWidth: 120 },
  { key: 'closing_month', title: '关账月份', defaultWidth: 100 },
  { key: 'remarks', title: '备注', defaultWidth: 160 },
  { key: 'style_image', title: '款式图', defaultWidth: 72 },
  { key: 'fabric_readiness', title: '面料进度', defaultWidth: 180 },
  { key: 'accessories_readiness', title: '辅料进度', defaultWidth: 180 },
  { key: 'fabric_structure', title: '面料结构', defaultWidth: 110 },
  { key: 'sample_progress', title: '样衣进度', defaultWidth: 110 },
  { key: 'printing_embroidery', title: '印绣花', defaultWidth: 100 },
  { key: 'order_follower', title: '跟单员', defaultWidth: 96 },
  { key: 'processing_unit_price', title: '加工单价', defaultWidth: 100 },
  { key: 'processing_output_value', title: '加工产值', defaultWidth: 100 },
  { key: 'sales_price', title: '销售单价', defaultWidth: 100 },
  { key: 'sales_output_value', title: '销售产值', defaultWidth: 100 },
  { key: 'action', title: '操作', hideable: false, defaultWidth: 80 },
];

export const SCHEDULING_COLUMNS: ColumnPrefItem[] = [
  { key: 'group_name', title: '组别', defaultWidth: 90 },
  { key: 'online_time', title: '上线时间', defaultWidth: 120 },
  { key: 'offline_time', title: '下线时间', defaultWidth: 120 },
  { key: 'days', title: '天数', defaultWidth: 70 },
  { key: 'scheduled_output', title: '排产数量', defaultWidth: 90 },
  { key: 'avg_daily_output', title: '日均产量', defaultWidth: 90 },
  { key: 'output_ratio', title: '比例', defaultWidth: 70 },
  { key: 'short_over_shipment', title: '短溢装', defaultWidth: 90 },
  { key: 'is_outsourced', title: '外发', defaultWidth: 70 },
  { key: 'outsourced_factory', title: '外发工厂', defaultWidth: 110 },
  { key: 'overseas_merchandiser', title: '海外跟单', defaultWidth: 100 },
  { key: 'outsourced_price', title: '外发价格', defaultWidth: 90 },
  { key: 'first_bed_time', title: '首床时间', defaultWidth: 120 },
  { key: 'style_number', title: '款号', defaultWidth: 110 },
  { key: 'style_name', title: '款式名称', defaultWidth: 120 },
  { key: 'action', title: '操作', hideable: false, defaultWidth: 80 },
];

export const EARLY_WARNING_DEFAULT_WIDTHS = Object.fromEntries(
  EARLY_WARNING_COLUMNS.map((c) => [c.key, c.defaultWidth]),
) as Record<string, number>;

export function normalizeViewColumnPreferences(
  raw: Partial<ColumnPreferences> | null,
  defs: ColumnPrefItem[],
): ColumnPreferences {
  return normalizeColumnPreferencesForDefs(raw, defs);
}

export function loadViewColumnPreferences(storageKey: string, defs: ColumnPrefItem[]): ColumnPreferences {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return normalizeViewColumnPreferences(null, defs);
    return normalizeViewColumnPreferences(JSON.parse(saved) as Partial<ColumnPreferences>, defs);
  } catch {
    return normalizeViewColumnPreferences(null, defs);
  }
}

export function saveViewColumnPreferences(storageKey: string, prefs: ColumnPreferences, defs: ColumnPrefItem[]) {
  localStorage.setItem(storageKey, JSON.stringify(normalizeViewColumnPreferences(prefs, defs)));
}

export const EARLY_WARNING_STORAGE_KEY = 'scheduling-early-warning-columns';
export const SCHEDULING_STORAGE_KEY = 'scheduling-scheduling-columns';
