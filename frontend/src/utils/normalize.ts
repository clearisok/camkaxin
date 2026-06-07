export function toOptionalNum(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = parseFloat(String(value));
  return Number.isNaN(n) ? undefined : n;
}

/** 将 API 返回的 decimal 字符串转为 number */
export function toNum(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') return Number.isNaN(value) ? fallback : value;
  const n = parseFloat(String(value));
  return Number.isNaN(n) ? fallback : n;
}

export function roundRate(value: unknown, fallback = 6.8): number {
  return Math.round(toNum(value, fallback) * 100) / 100;
}

/** ISO 日期转 YYYY-MM-DD */
export function toDateString(value: unknown): string | undefined {
  if (!value) return undefined;
  const s = String(value);
  return s.includes('T') ? s.slice(0, 10) : s;
}

function normalizeFabric(row: Record<string, unknown>) {
  const { _field_meta, ...rest } = row;
  return {
    ...rest,
    fabric_id: row.fabric_id != null ? toNum(row.fabric_id) : undefined,
    weight: row.weight != null ? toNum(row.weight) : undefined,
    net_width: row.net_width != null ? toNum(row.net_width) : undefined,
    gross_width: row.gross_width != null ? toNum(row.gross_width) : undefined,
    piece_length: toNum(row.piece_length),
    wastage: toNum(row.wastage, 5),
    default_wastage: row.default_wastage != null ? toNum(row.default_wastage, 5) : undefined,
    consumption: toNum(row.consumption),
    unit_price: toNum(row.unit_price),
    amount: toNum(row.amount),
  };
}

function normalizeAccessory(row: Record<string, unknown>) {
  const { _field_meta, ...rest } = row;
  return {
    ...rest,
    accessory_id: row.accessory_id != null ? toNum(row.accessory_id) : undefined,
    consumption: toNum(row.consumption, 1),
    wastage: toNum(row.wastage, 5),
    unit_price: toNum(row.unit_price),
    amount: toNum(row.amount),
    specification: row.specification != null ? String(row.specification) : undefined,
  };
}

function normalizeItem(item: Record<string, unknown>) {
  const { _field_meta, ...rest } = item;
  return {
    ...rest,
    quantity: toNum(item.quantity),
    labor_cost_usd: toNum(item.labor_cost_usd),
    other_cost_rmb: toNum(item.other_cost_rmb),
    shipping_rmb: toNum(item.shipping_rmb, 1),
    fabric_total: toNum(item.fabric_total),
    accessory_total: toNum(item.accessory_total),
    labor_rmb: toNum(item.labor_rmb),
    subtotal_rmb: toNum(item.subtotal_rmb),
    final_price: toNum(item.final_price),
    version: toNum(item.version, 1),
    fabrics: ((item.fabrics as Record<string, unknown>[]) || []).map(normalizeFabric),
    accessories: ((item.accessories as Record<string, unknown>[]) || []).map(normalizeAccessory),
    quantity_tiers: item.quantity_tiers || [],
    sample_images: parseJsonArray(item.sample_images),
    sample_videos: parseJsonArray(item.sample_videos),
    pattern_files: parseJsonArray(item.pattern_files),
    layout_files: parseJsonArray(item.layout_files),
  };
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** 规范化 GET /quotations/:id 响应，避免 decimal 字符串导致 .toFixed 崩溃 */
export function normalizeQuotationFromApi(data: Record<string, unknown>) {
  const { _field_meta, ...rest } = data;
  return {
    ...rest,
    exchange_rate: roundRate(data.exchange_rate, 6.8),
    profit_margin: toNum(data.profit_margin, 5),
    quote_date: toDateString(data.quote_date),
    fabric_delivery_date: toDateString(data.fabric_delivery_date),
    garment_delivery_date: toDateString(data.garment_delivery_date ?? data.valid_until),
    target_labor_price: toOptionalNum(data.target_labor_price),
    target_garment_price: toOptionalNum(data.target_garment_price),
    confirmed_labor_price: toOptionalNum(data.confirmed_labor_price),
    confirmed_garment_price: toOptionalNum(data.confirmed_garment_price),
    items: ((data.items as Record<string, unknown>[]) || []).map(normalizeItem),
  };
}
