import type { ColumnPrefItem, ColumnPreferences } from '@/utils/quotationListColumnPrefs';
import { normalizeColumnPreferencesForDefs } from '@/utils/quotationListColumnPrefs';

/** 与款式详情页字段顺序、分组保持一致 */
export const EARLY_WARNING_COLUMNS: ColumnPrefItem[] = [
  { key: 'style_number', title: '款号', defaultWidth: 110 },
  { key: 'brand', title: '品牌', defaultWidth: 100 },
  { key: 'quantity', title: '数量', defaultWidth: 80 },
  { key: 'order_type', title: '订单类型', defaultWidth: 90 },
  { key: 'cancelled_quantity', title: '取消件数', defaultWidth: 90 },
  { key: 'style_name', title: '款式名称', defaultWidth: 120 },
  { key: 'salesperson', title: '业务员', defaultWidth: 96 },
  { key: 'po_number', title: 'PO号', defaultWidth: 110 },
  { key: 'required_shipping_date', title: '要求出货日', defaultWidth: 120 },
  { key: 'closing_month', title: '关账月份', defaultWidth: 100 },
  { key: 'remarks', title: '备注', defaultWidth: 160 },
  { key: 'style_image', title: '款式图', defaultWidth: 72 },
  { key: 'fabric_readiness', title: '面辅料', defaultWidth: 200 },
  { key: 'fabric_structure', title: '面料结构', defaultWidth: 110 },
  { key: 'sample_progress', title: '样衣进度', defaultWidth: 110 },
  { key: 'printing_embroidery', title: '印绣花', defaultWidth: 100 },
  { key: 'order_follower', title: '跟单员', defaultWidth: 96 },
  { key: 'processing_unit_price', title: '加工单价', defaultWidth: 100 },
  { key: 'processing_output_value', title: '加工产值（万美金）', defaultWidth: 100 },
  { key: 'sales_price', title: '销售单价', defaultWidth: 100 },
  { key: 'sales_output_value', title: '销售产值（万元）', defaultWidth: 100 },
  { key: 'required_days', title: '所需天数', defaultWidth: 80 },
  { key: 'is_outsourced', title: '是否外发', defaultWidth: 80 },
  { key: 'group_name', title: '排入组别', defaultWidth: 90 },
  { key: 'outsourced_factory', title: '外发工厂', defaultWidth: 120 },
  { key: 'outsourced_price', title: '外发单价', defaultWidth: 90 },
  { key: 'online_time', title: '上线时间', defaultWidth: 110 },
  { key: 'offline_time', title: '下线时间', defaultWidth: 110 },
  { key: 'action', title: '操作', hideable: false, defaultWidth: 80 },
];

/** 排单视图：预警核心列 + 排产列 */
export const SCHEDULING_COLUMNS: ColumnPrefItem[] = [
  { key: 'style_number', title: '款号', defaultWidth: 110 },
  { key: 'brand', title: '品牌', defaultWidth: 100 },
  { key: 'style_name', title: '款式名称', defaultWidth: 120 },
  { key: 'salesperson', title: '业务员', defaultWidth: 96 },
  { key: 'po_number', title: 'PO号', defaultWidth: 110 },
  { key: 'quantity', title: '订单数量', defaultWidth: 90 },
  { key: 'required_shipping_date', title: '要求出货日', defaultWidth: 120 },
  { key: 'fabric_readiness', title: '面辅料进度', defaultWidth: 200 },
  { key: 'online_time', title: '上线时间', defaultWidth: 120 },
  { key: 'offline_time', title: '下线时间', defaultWidth: 120 },
  { key: 'required_days', title: '所需天数', defaultWidth: 80 },
  { key: 'holiday_days', title: '假期天数', defaultWidth: 80 },
  { key: 'scheduled_output', title: '排入数量', defaultWidth: 90 },
  { key: 'avg_daily_output', title: '日均产量', defaultWidth: 90 },
  { key: 'scheduling_remarks', title: '排单备注', defaultWidth: 140 },
  { key: 'move_target', title: '调入区位', defaultWidth: 130, hideable: false },
  { key: 'action', title: '操作', hideable: false, defaultWidth: 160 },
];

export const EARLY_WARNING_DEFAULT_WIDTHS = Object.fromEntries(
  EARLY_WARNING_COLUMNS.map((c) => [c.key, c.defaultWidth]),
) as Record<string, number>;

export const SCHEDULING_DEFAULT_WIDTHS = Object.fromEntries(
  SCHEDULING_COLUMNS.map((c) => [c.key, c.defaultWidth]),
) as Record<string, number>;

export function normalizeViewColumnPreferences(
  raw: Partial<ColumnPreferences> | null,
  defs: ColumnPrefItem[],
): ColumnPreferences {
  return normalizeColumnPreferencesForDefs(raw, defs);
}

function migrateDaysToRequiredDays(raw: Partial<ColumnPreferences> | null): Partial<ColumnPreferences> | null {
  if (!raw) return raw;
  const order = raw.order?.map((k) => (k === 'days' ? 'required_days' : k));
  const visible = raw.visible ? { ...raw.visible } : undefined;
  if (visible && 'days' in visible) {
    visible.required_days = visible.days;
    delete visible.days;
  }
  const widths = raw.widths ? { ...raw.widths } : undefined;
  if (widths && widths.days != null) {
    widths.required_days = widths.days;
    delete widths.days;
  }
  return { ...raw, order, visible, widths };
}

export function loadViewColumnPreferences(storageKey: string, defs: ColumnPrefItem[]): ColumnPreferences {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return normalizeViewColumnPreferences(null, defs);
    let parsed = JSON.parse(saved) as Partial<ColumnPreferences>;
    if (storageKey === SCHEDULING_STORAGE_KEY || storageKey === SCHEDULING_SESSION_STORAGE_KEY) {
      parsed = migrateDaysToRequiredDays(parsed) ?? parsed;
    }
    return normalizeViewColumnPreferences(parsed, defs);
  } catch {
    return normalizeViewColumnPreferences(null, defs);
  }
}

export function saveViewColumnPreferences(storageKey: string, prefs: ColumnPreferences, defs: ColumnPrefItem[]) {
  localStorage.setItem(storageKey, JSON.stringify(normalizeViewColumnPreferences(prefs, defs)));
}

export const EARLY_WARNING_STORAGE_KEY = 'scheduling-early-warning-columns';
export const SCHEDULING_STORAGE_KEY = 'scheduling-scheduling-columns';
export const CLOSING_STORAGE_KEY = 'scheduling-closing-columns';

/** 关账视图：预警全部字段 + 订单状态 */
export const CLOSING_COLUMNS: ColumnPrefItem[] = (() => {
  const cols: ColumnPrefItem[] = [];
  for (const col of EARLY_WARNING_COLUMNS) {
    cols.push(col);
    if (col.key === 'closing_month') {
      cols.push({ key: 'order_status', title: '订单状态', defaultWidth: 96 });
    }
  }
  return cols;
})();

export const CLOSING_DEFAULT_WIDTHS = Object.fromEntries(
  CLOSING_COLUMNS.map((c) => [c.key, c.defaultWidth]),
) as Record<string, number>;

/** 排单模式（开始排单）左侧主视图：可单独配置显示列 */
export const SCHEDULING_SESSION_COLUMNS: ColumnPrefItem[] = [
  { key: 'style_number', title: '款号', defaultWidth: 110 },
  { key: 'brand', title: '品牌', defaultWidth: 100 },
  { key: 'style_name', title: '款式名称', defaultWidth: 120 },
  { key: 'salesperson', title: '业务员', defaultWidth: 96 },
  { key: 'po_number', title: 'PO号', defaultWidth: 110 },
  { key: 'quantity', title: '订单数量', defaultWidth: 90 },
  { key: 'required_shipping_date', title: '要求出货日', defaultWidth: 120 },
  { key: 'fabric_readiness', title: '面辅料进度', defaultWidth: 200 },
  { key: 'online_time', title: '上线时间', defaultWidth: 120 },
  { key: 'offline_time', title: '下线时间', defaultWidth: 120 },
  { key: 'required_days', title: '所需天数', defaultWidth: 80 },
  { key: 'holiday_days', title: '假期天数', defaultWidth: 80 },
  { key: 'scheduled_output', title: '排入数量', defaultWidth: 90 },
  { key: 'avg_daily_output', title: '日均产量', defaultWidth: 90 },
  { key: 'scheduling_remarks', title: '排单备注', defaultWidth: 140 },
  { key: 'outsourced_factory', title: '外发工厂', defaultWidth: 140 },
  { key: 'outsourced_price', title: '外发价格', defaultWidth: 100 },
  { key: 'move_target', title: '调入区位', defaultWidth: 130 },
  { key: 'action', title: '操作', defaultWidth: 160 },
];

export const SCHEDULING_SESSION_DEFAULT_WIDTHS = Object.fromEntries(
  SCHEDULING_SESSION_COLUMNS.map((c) => [c.key, c.defaultWidth]),
) as Record<string, number>;

export const SCHEDULING_SESSION_STORAGE_KEY = 'scheduling-session-columns';
