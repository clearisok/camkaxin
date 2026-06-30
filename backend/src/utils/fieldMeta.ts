/** 字段元数据 - 权限预留 */
export interface FieldMeta {
  field_code: string;
  label: string;
  type: string;
  module?: string;
}

function withModule(fields: FieldMeta[]): FieldMeta[] {
  return fields.map((f) => ({ ...f, module: f.field_code.split('.')[0] }));
}

export const AGENT_FIELDS: FieldMeta[] = withModule([
  { field_code: 'agent.name', label: '业务员姓名', type: 'string' },
  { field_code: 'agent.status', label: '状态', type: 'enum' },
  { field_code: 'agent.default_wastage', label: '默认损耗', type: 'integer' },
  { field_code: 'agent.brand_id', label: '所属品牌', type: 'relation' },
]);

export const BRAND_FIELDS: FieldMeta[] = withModule([
  { field_code: 'brand.name', label: '品牌名称', type: 'string' },
  { field_code: 'brand.status', label: '状态', type: 'enum' },
]);

export const FABRIC_FIELDS: FieldMeta[] = withModule([
  { field_code: 'fabric.name', label: '面料名称', type: 'string' },
  { field_code: 'fabric.composition', label: '成分', type: 'string' },
  { field_code: 'fabric.weight', label: '克重', type: 'number' },
  { field_code: 'fabric.net_width', label: '净门幅', type: 'number' },
  { field_code: 'fabric.gross_width', label: '毛门幅', type: 'number' },
  { field_code: 'fabric.unit', label: '单位', type: 'enum' },
  { field_code: 'fabric.reference_price', label: '参考单价', type: 'decimal' },
  { field_code: 'fabric.default_wastage', label: '默认损耗', type: 'integer' },
]);

export const ACCESSORY_FIELDS: FieldMeta[] = withModule([
  { field_code: 'accessory.name', label: '辅料名称', type: 'string' },
  { field_code: 'accessory.reference_price', label: '参考单价', type: 'decimal' },
  { field_code: 'accessory.specification', label: '规格', type: 'string' },
]);

export const QUOTATION_FIELDS: FieldMeta[] = withModule([
  { field_code: 'quotation.quotation_no', label: '报价单号', type: 'string' },
  { field_code: 'quotation.brand_id', label: '品牌', type: 'relation' },
  { field_code: 'quotation.agent_name', label: '业务员', type: 'string' },
  { field_code: 'quotation.currency', label: '报价币种', type: 'enum' },
  { field_code: 'quotation.exchange_rate', label: '汇率', type: 'decimal' },
  { field_code: 'quotation.quote_date', label: '报价日期', type: 'date' },
  { field_code: 'quotation.fabric_delivery_date', label: '面料交期', type: 'date' },
  { field_code: 'quotation.garment_delivery_date', label: '成衣交期', type: 'date' },
  { field_code: 'quotation.target_labor_price', label: '目标工价', type: 'decimal' },
  { field_code: 'quotation.target_garment_price', label: '目标成衣价格', type: 'decimal' },
  { field_code: 'quotation.confirmed_labor_price', label: '确认工价', type: 'decimal' },
  { field_code: 'quotation.confirmed_garment_price', label: '确认成衣价格', type: 'decimal' },
  { field_code: 'quotation.profit_margin', label: '利润率', type: 'integer' },
  { field_code: 'quotation.remarks', label: '备注', type: 'text' },
  { field_code: 'quotation.style_image', label: '款式图', type: 'file' },
  { field_code: 'quotation.status', label: '状态', type: 'enum' },
  { field_code: 'quotation.fabric_total', label: '面料价格', type: 'decimal' },
  { field_code: 'quotation.accessory_total', label: '辅料价格', type: 'decimal' },
  { field_code: 'quotation.labor_rmb', label: '工价', type: 'decimal' },
  { field_code: 'quotation.product_codes', label: '款号', type: 'string' },
  { field_code: 'quotation.total_quantity', label: '数量', type: 'integer' },
]);

export const ITEM_FIELDS: FieldMeta[] = withModule([
  { field_code: 'item.product_code', label: '款号', type: 'string' },
  { field_code: 'item.version_label', label: '版本标签', type: 'string' },
  { field_code: 'item.style_image', label: '款式图', type: 'file' },
  { field_code: 'item.delivery_date', label: '交期', type: 'text' },
  { field_code: 'item.quantity', label: '数量', type: 'integer' },
  { field_code: 'item.description', label: '描述', type: 'text' },
  { field_code: 'item.labor_cost_usd', label: '工价(USD)', type: 'decimal' },
  { field_code: 'item.other_cost_rmb', label: '其他费用(RMB)', type: 'decimal' },
  { field_code: 'item.shipping_rmb', label: '运费(RMB)', type: 'decimal' },
  { field_code: 'item.fabric_total', label: '面料总成本', type: 'decimal' },
  { field_code: 'item.accessory_total', label: '辅料总成本', type: 'decimal' },
  { field_code: 'item.labor_rmb', label: '工价(RMB)', type: 'decimal' },
  { field_code: 'item.subtotal_rmb', label: '成本小计', type: 'decimal' },
  { field_code: 'item.final_price', label: '最终报价', type: 'decimal' },
]);

export const STYLE_FIELDS: FieldMeta[] = withModule([
  { field_code: 'style.style_number', label: '款号', type: 'string' },
  { field_code: 'style.brand', label: '品牌', type: 'string' },
  { field_code: 'style.style_name', label: '款式名称', type: 'string' },
  { field_code: 'style.quantity', label: '数量', type: 'integer' },
  { field_code: 'style.style_image', label: '款式图', type: 'file' },
  { field_code: 'style.salesperson', label: '业务员', type: 'string' },
  { field_code: 'style.po_number', label: 'PO', type: 'string' },
  { field_code: 'style.closing_month', label: '关账月份', type: 'string' },
  { field_code: 'style.processing_unit_price', label: '加工单价', type: 'decimal' },
  { field_code: 'style.sales_price', label: '销售单价', type: 'decimal' },
  { field_code: 'style.processing_output_value', label: '加工产值', type: 'decimal' },
  { field_code: 'style.sales_output_value', label: '销售产值', type: 'decimal' },
  { field_code: 'style.fabric_structure', label: '面料结构', type: 'string' },
  { field_code: 'style.fabric_readiness', label: '面料进度', type: 'string' },
  { field_code: 'style.accessories_readiness', label: '辅料进度', type: 'string' },
  { field_code: 'style.sample_progress', label: '样衣进度', type: 'string' },
  { field_code: 'style.group_name', label: '生产组别', type: 'string' },
  { field_code: 'style.scheduled_output', label: '排入数量', type: 'integer' },
  { field_code: 'style.required_days', label: '所需天数', type: 'integer' },
  { field_code: 'style.online_time', label: '上线时间', type: 'datetime' },
  { field_code: 'style.offline_time', label: '下线时间', type: 'datetime' },
  { field_code: 'style.is_outsourced', label: '是否外发', type: 'boolean' },
  { field_code: 'style.outsourced_factory', label: '外发工厂', type: 'string' },
  { field_code: 'style.outsourced_price', label: '外发单价', type: 'decimal' },
  { field_code: 'style.required_shipping_date', label: '出货日', type: 'date' },
  { field_code: 'style.scheduling_remarks', label: '排单备注', type: 'text' },
  { field_code: 'style.remarks', label: '备注', type: 'text' },
]);

export const ALL_FIELD_META: FieldMeta[] = [
  ...AGENT_FIELDS,
  ...BRAND_FIELDS,
  ...FABRIC_FIELDS,
  ...ACCESSORY_FIELDS,
  ...QUOTATION_FIELDS,
  ...ITEM_FIELDS,
  ...STYLE_FIELDS,
];

/** DB 列名 → field_code（报价主表） */
export const QUOTATION_DB_TO_FIELD: Record<string, string> = {
  brand_id: 'quotation.brand_id',
  agent_name: 'quotation.agent_name',
  currency: 'quotation.currency',
  exchange_rate: 'quotation.exchange_rate',
  quote_date: 'quotation.quote_date',
  fabric_delivery_date: 'quotation.fabric_delivery_date',
  garment_delivery_date: 'quotation.garment_delivery_date',
  target_labor_price: 'quotation.target_labor_price',
  target_garment_price: 'quotation.target_garment_price',
  confirmed_labor_price: 'quotation.confirmed_labor_price',
  confirmed_garment_price: 'quotation.confirmed_garment_price',
  profit_margin: 'quotation.profit_margin',
  remarks: 'quotation.remarks',
  style_image: 'quotation.style_image',
  status: 'quotation.status',
};

/** DB 列名 → field_code（报价明细） */
export const ITEM_DB_TO_FIELD: Record<string, string> = {
  product_code: 'item.product_code',
  version_label: 'item.version_label',
  style_image: 'item.style_image',
  delivery_date: 'item.delivery_date',
  quantity: 'item.quantity',
  description: 'item.description',
  labor_cost_usd: 'item.labor_cost_usd',
  other_cost_rmb: 'item.other_cost_rmb',
  shipping_rmb: 'item.shipping_rmb',
};

/** DB 列名 → field_code（款式/排单） */
export const STYLE_DB_TO_FIELD: Record<string, string> = Object.fromEntries(
  STYLE_FIELDS.map((f) => [f.field_code.replace('style.', ''), f.field_code]),
);

/** 为响应数据附加 field_meta */
export function withFieldMeta<T extends Record<string, unknown>>(
  data: T,
  fields: FieldMeta[]
): T & { _field_meta: FieldMeta[] } {
  return { ...data, _field_meta: fields };
}
