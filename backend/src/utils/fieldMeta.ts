/** 字段元数据 - 权限预留 */
export interface FieldMeta {
  field_code: string;
  label: string;
  type: string;
}

export const AGENT_FIELDS: FieldMeta[] = [
  { field_code: 'agent.name', label: '业务员姓名', type: 'string' },
  { field_code: 'agent.status', label: '状态', type: 'enum' },
];

export const BRAND_FIELDS: FieldMeta[] = [
  { field_code: 'brand.name', label: '品牌名称', type: 'string' },
  { field_code: 'brand.agent_id', label: '关联业务员', type: 'relation' },
  { field_code: 'brand.status', label: '状态', type: 'enum' },
];

export const FABRIC_FIELDS: FieldMeta[] = [
  { field_code: 'fabric.name', label: '面料名称', type: 'string' },
  { field_code: 'fabric.composition', label: '成分', type: 'string' },
  { field_code: 'fabric.weight', label: '克重', type: 'number' },
  { field_code: 'fabric.net_width', label: '净门幅', type: 'number' },
  { field_code: 'fabric.gross_width', label: '毛门幅', type: 'number' },
  { field_code: 'fabric.unit', label: '单位', type: 'enum' },
  { field_code: 'fabric.reference_price', label: '参考单价', type: 'decimal' },
];

export const ACCESSORY_FIELDS: FieldMeta[] = [
  { field_code: 'accessory.name', label: '辅料名称', type: 'string' },
  { field_code: 'accessory.reference_price', label: '参考单价', type: 'decimal' },
];

export const QUOTATION_FIELDS: FieldMeta[] = [
  { field_code: 'quotation.quotation_no', label: '报价单号', type: 'string' },
  { field_code: 'quotation.brand_id', label: '品牌', type: 'relation' },
  { field_code: 'quotation.agent_name', label: '业务员', type: 'string' },
  { field_code: 'quotation.currency', label: '报价币种', type: 'enum' },
  { field_code: 'quotation.exchange_rate', label: '汇率', type: 'decimal' },
  { field_code: 'quotation.quote_date', label: '报价日期', type: 'date' },
  { field_code: 'quotation.valid_until', label: '有效期至', type: 'date' },
  { field_code: 'quotation.profit_margin', label: '利润率', type: 'integer' },
  { field_code: 'quotation.remarks', label: '备注', type: 'text' },
  { field_code: 'quotation.status', label: '状态', type: 'enum' },
];

export const ITEM_FIELDS: FieldMeta[] = [
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
];

/** 为响应数据附加 field_meta */
export function withFieldMeta<T extends Record<string, unknown>>(
  data: T,
  fields: FieldMeta[]
): T & { _field_meta: FieldMeta[] } {
  return { ...data, _field_meta: fields };
}
