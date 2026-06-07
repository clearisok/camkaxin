import type { ColumnPrefItem, ColumnPreferences } from '@/utils/quotationListColumnPrefs';

export const EARLY_WARNING_COLUMNS: ColumnPrefItem[] = [
  { key: 'brand', title: '品牌', defaultWidth: 100 },
  { key: 'style_number', title: '款号', defaultWidth: 110 },
  { key: 'style_name', title: '款式名称', defaultWidth: 120 },
  { key: 'closing_month', title: '关账月份', defaultWidth: 100 },
  { key: 'style_image', title: '款式图', defaultWidth: 72 },
  { key: 'fabric_structure', title: '面料结构', defaultWidth: 110 },
  { key: 'fabric_readiness', title: '面料进度', defaultWidth: 90 },
  { key: 'accessories_readiness', title: '辅料进度', defaultWidth: 90 },
  { key: 'sample_progress', title: '样衣进度', defaultWidth: 90 },
  { key: 'po_number', title: 'PO号', defaultWidth: 110 },
  { key: 'quantity', title: '数量', defaultWidth: 80 },
  { key: 'processing_unit_price', title: '加工单价', defaultWidth: 100 },
  { key: 'processing_output_value', title: '加工产值', defaultWidth: 100 },
  { key: 'sales_price', title: '销售单价', defaultWidth: 100 },
  { key: 'sales_output_value', title: '销售产值', defaultWidth: 100 },
  { key: 'printing_embroidery', title: '印绣花', defaultWidth: 100 },
  { key: 'order_follower', title: '跟单员', defaultWidth: 90 },
  { key: 'required_shipping_date', title: '要求出货日', defaultWidth: 110 },
  { key: 'remarks', title: '备注', defaultWidth: 140 },
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

export function normalizeViewColumnPreferences(
  raw: Partial<ColumnPreferences> | null,
  defs: ColumnPrefItem[]
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
  const widths = { ...defaults };
  for (const col of defs) {
    if (raw?.widths && col.key in raw.widths) {
      widths[col.key] = raw.widths[col.key];
    }
  }
  return { order, visible, widths };
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
