export interface StyleRecord {
  id: number;
  _dirty?: boolean;
  salesperson?: string;
  brand?: string;
  style_number?: string;
  style_name?: string;
  closing_month?: string;
  style_image?: string;
  fabric_structure?: string;
  fabric_readiness?: string;
  accessories_readiness?: string;
  sample_progress?: string;
  first_bed_time?: string;
  po_number?: string;
  online_time?: string;
  offline_time?: string;
  days?: number | null;
  scheduled_output?: number;
  avg_daily_output?: number;
  output_ratio?: number | null;
  group_name?: string;
  short_over_shipment?: string;
  quantity?: number;
  processing_unit_price?: number;
  processing_output_value?: number | null;
  sales_price?: number;
  sales_output_value?: number | null;
  printing_embroidery?: string;
  order_follower?: string;
  required_shipping_date?: string;
  remarks?: string;
  is_outsourced?: boolean;
  outsourced_factory?: string;
  overseas_merchandiser?: string;
  outsourced_price?: number;
  scheduling_zone?: 'wait' | 'group' | 'outsource' | 'offline';
  sort_order?: number | null;
  required_days?: number | null;
  parent_style_id?: number | null;
  scheduling_remarks?: string | null;
  /** 母单：已排入各组/外发的累计数量 */
  allocated_quantity?: number;
  /** 母单：未排数量 */
  unscheduled_quantity?: number;
  created_at?: string;
  updated_at?: string;
}

export interface StyleHistoryRecord {
  id: number;
  style_id: number;
  changed_data: Record<string, { old: unknown; new: unknown }>;
  changed_by: string;
  changed_at: string;
}

export interface MonthlySummaryItem {
  closing_month: string;
  total_sales_output_value: number;
  count: number;
}

export type SchedulingViewType = 'early_warning' | 'scheduling' | 'closing';

export const STYLE_FIELD_LABELS: Record<string, string> = {
  salesperson: '业务员',
  brand: '品牌',
  style_number: '款号',
  style_name: '款式名称',
  closing_month: '关账月份',
  style_image: '款式图',
  fabric_structure: '面料结构',
  fabric_readiness: '面料进度',
  accessories_readiness: '辅料进度',
  sample_progress: '样衣进度',
  first_bed_time: '首床时间',
  po_number: 'PO号',
  online_time: '上线时间',
  offline_time: '下线时间',
  scheduled_output: '排产数量',
  avg_daily_output: '日均产量',
  group_name: '组别',
  short_over_shipment: '短溢装',
  quantity: '数量',
  processing_unit_price: '加工单价',
  sales_price: '销售单价',
  printing_embroidery: '印绣花',
  order_follower: '跟单员',
  required_shipping_date: '要求出货日',
  remarks: '备注',
  is_outsourced: '是否外发',
  outsourced_factory: '外发工厂',
  overseas_merchandiser: '海外跟单',
  outsourced_price: '外发价格',
  scheduling_zone: '排单区位',
  sort_order: '排单顺位',
  required_days: '所需天数',
};

export const CLOSING_MONTH_OPTIONS = [
  '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
  '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12',
  '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06',
];
