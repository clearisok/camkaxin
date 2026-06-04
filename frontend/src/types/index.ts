export interface Agent {
  id: number;
  name: string;
  status: string;
}

export interface Brand {
  id: number;
  name: string;
  agent_id?: number;
  agent_name_ref?: string;
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
  use_count?: number;
}

export interface Accessory {
  id?: number;
  accessory_id?: number;
  name: string;
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
  valid_until?: string;
  profit_margin: number;
  remarks?: string;
  status?: string;
  items?: QuotationItem[];
}

export function createEmptyItem(): QuotationItem {
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

export function createEmptyFabric(): Fabric {
  return {
    name: '',
    unit: 'meter',
    piece_length: 0,
    wastage: 5,
    unit_price: 0,
  };
}

export function createEmptyAccessory(): Accessory {
  return {
    name: '',
    consumption: 1,
    wastage: 5,
    unit_price: 0,
  };
}
