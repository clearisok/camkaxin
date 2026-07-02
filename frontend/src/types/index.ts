export interface Agent {
  id: number;
  name: string;
  brand_id?: number;
  brand_name_ref?: string;
  status: string;
  default_wastage?: number;
}

export interface Brand {
  id: number;
  name: string;
  agents?: { id: number; name: string; default_wastage?: number; status?: string }[];
  status: string;
  use_count?: number;
  last_used_at?: string;
}

export interface Fabric {
  id?: number;
  fabric_id?: number;
  name: string;
  composition?: string;
  weight?: number;
  net_width?: number;
  gross_width?: number;
  unit: 'meter' | 'kg';
  piece_length?: number;
  wastage?: number;
  consumption?: number;
  unit_price?: number;
  amount?: number;
  reference_price?: number;
  default_wastage?: number;
  use_count?: number;
}

export interface Accessory {
  id?: number;
  accessory_id?: number;
  name: string;
  specification?: string;
  consumption?: number;
  wastage?: number;
  unit_price?: number;
  amount?: number;
  reference_price?: number;
  use_count?: number;
}

export interface QuantityTier {
  min_qty: number;
  max_qty?: number;
  price: number;
}

export interface QuotationItem {
  id?: number;
  item_no?: string;
  product_code?: string;
  version_label?: string;
  style_image?: string;
  delivery_date?: string;
  quantity?: number;
  description?: string;
  labor_cost_usd?: number;
  other_cost_rmb?: number;
  shipping_rmb?: number;
  fabric_total?: number;
  accessory_total?: number;
  labor_rmb?: number;
  subtotal_rmb?: number;
  final_price?: number;
  version?: number;
  fabrics?: Fabric[];
  accessories?: Accessory[];
  quantity_tiers?: QuantityTier[];
  sample_images?: string[];
  sample_videos?: string[];
  pattern_files?: string[];
  layout_files?: string[];
  showVersionLabel?: boolean;
}

export interface Quotation {
  id?: number;
  quotation_no?: string;
  brand_id?: number;
  brand_name?: string;
  agent_name?: string;
  currency: 'RMB' | 'USD';
  exchange_rate: number;
  quote_date?: string;
  fabric_delivery_date?: string;
  garment_delivery_date?: string;
  target_labor_price?: number;
  target_garment_price?: number;
  confirmed_labor_price?: number;
  confirmed_garment_price?: number;
  profit_margin: number;
  style_image?: string;
  remarks?: string;
  status?: string;
  fabric_total?: number;
  accessory_total?: number;
  labor_rmb?: number;
  product_codes?: string;
  total_quantity?: number;
  list_style_image?: string;
  items?: QuotationItem[];
}

export const UNIT_LABELS: Record<string, string> = { meter: '米', kg: '千克' };

export function createEmptyItem(defaultWastage = 5): QuotationItem {
  return {
    product_code: '',
    version_label: '',
    quantity: 0,
    labor_cost_usd: 0,
    other_cost_rmb: 0,
    shipping_rmb: 1,
    fabrics: [],
    accessories: [],
    quantity_tiers: [],
    sample_images: [],
    sample_videos: [],
    pattern_files: [],
    layout_files: [],
    showVersionLabel: false,
  };
}

export function createEmptyFabric(defaultWastage = 5): Fabric {
  return {
    name: '',
    composition: '',
    unit: 'meter',
    piece_length: 0,
    wastage: defaultWastage,
    unit_price: 0,
  };
}

export function createEmptyAccessory(defaultWastage = 5): Accessory {
  return {
    name: '',
    specification: '',
    consumption: 1,
    wastage: defaultWastage,
    unit_price: 0,
  };
}
