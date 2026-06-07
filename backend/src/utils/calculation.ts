/**
 * 报价核心计算逻辑
 * 所有金额保留两位小数，损耗为整数百分比
 */

export type FabricUnit = 'meter' | 'kg';

export interface FabricInput {
  pieceLength: number;
  wastage: number;
  unit: FabricUnit;
  netWidth?: number;
  grossWidth?: number;
  weight?: number;
  unitPrice: number;
}

export interface AccessoryInput {
  consumption: number;
  wastage: number;
  unitPrice: number;
}

export interface ItemCostInput {
  laborCostUsd: number;
  otherCostRmb: number;
  shippingRmb: number;
  fabrics: FabricInput[];
  accessories: AccessoryInput[];
}

export interface QuotationCalcInput {
  currency: 'RMB' | 'USD';
  exchangeRate: number;
  profitMargin: number;
  items: ItemCostInput[];
}

/** 保留两位小数 */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 毛门幅 = 净门幅 + 5 */
export function calcGrossWidth(netWidth: number): number {
  return netWidth + 5;
}

/** 净门幅 = 毛门幅 - 5 */
export function calcNetWidth(grossWidth: number): number {
  return Math.max(0, grossWidth - 5);
}

/** 优先使用毛门幅，否则由净门幅推算 */
export function resolveGrossWidth(fabric: Pick<FabricInput, 'netWidth' | 'grossWidth'>): number {
  if (fabric.grossWidth != null && fabric.grossWidth >= 0) {
    return fabric.grossWidth;
  }
  return calcGrossWidth(fabric.netWidth ?? 0);
}

/**
 * 面料单耗计算
 * 单位=米: ROUND(段长/100 × (1 + 损耗/100), 2)，单耗单位为米（段长为厘米）
 * 单位=千克: ROUND(段长 × 毛门幅/10000 × 克重/1000 × (1 + 损耗/100), 2)，单耗单位为千克
 */
export function calcFabricConsumption(fabric: FabricInput): number {
  const { pieceLength, wastage, unit, weight = 0 } = fabric;
  const wastageFactor = 1 + wastage / 100;

  if (unit === 'meter') {
    return round2((pieceLength / 100) * wastageFactor);
  }

  const grossWidth = resolveGrossWidth(fabric);
  return round2(
    pieceLength * (grossWidth / 10000) * (weight / 1000) * wastageFactor
  );
}

/** 面料金额 = 单耗 * 单价 */
export function calcFabricAmount(fabric: FabricInput): number {
  const consumption = calcFabricConsumption(fabric);
  return round2(consumption * fabric.unitPrice);
}

/** 辅料金额 = 单耗 * (1 + 损耗/100) * 单价 */
export function calcAccessoryAmount(accessory: AccessoryInput): number {
  const wastageFactor = 1 + accessory.wastage / 100;
  return round2(accessory.consumption * wastageFactor * accessory.unitPrice);
}

/** 工价(RMB) = 工价(USD) × 当前汇率 × 1.13 */
export function calcLaborRmb(laborCostUsd: number, exchangeRate: number): number {
  return round2(laborCostUsd * exchangeRate * 1.13);
}

export interface ItemCostResult {
  fabricTotal: number;
  accessoryTotal: number;
  laborRmb: number;
  subtotalRmb: number;
  finalPrice: number;
  fabrics: Array<{ consumption: number; amount: number }>;
  accessories: Array<{ amount: number }>;
}

/** 计算单条明细行成本 */
export function calcItemCost(
  item: ItemCostInput,
  exchangeRate: number,
  currency: 'RMB' | 'USD',
  profitMargin: number
): ItemCostResult {
  const fabricResults = item.fabrics.map((f) => {
    const consumption = calcFabricConsumption(f);
    const amount = round2(consumption * f.unitPrice);
    return { consumption, amount };
  });

  const accessoryResults = item.accessories.map((a) => ({
    amount: calcAccessoryAmount(a),
  }));

  const fabricTotal = round2(fabricResults.reduce((sum, f) => sum + f.amount, 0));
  const accessoryTotal = round2(
    accessoryResults.reduce((sum, a) => sum + a.amount, 0)
  );
  const laborRmb = calcLaborRmb(item.laborCostUsd, exchangeRate);

  const subtotalRmb = round2(
    fabricTotal + accessoryTotal + laborRmb + item.otherCostRmb + item.shippingRmb
  );

  let finalPrice: number;
  if (currency === 'RMB') {
    finalPrice = round2(subtotalRmb * (1 + profitMargin / 100));
  } else {
    finalPrice = round2((subtotalRmb / exchangeRate) * (1 + profitMargin / 100));
  }

  return {
    fabricTotal,
    accessoryTotal,
    laborRmb,
    subtotalRmb,
    finalPrice,
    fabrics: fabricResults,
    accessories: accessoryResults,
  };
}

/** 计算报价单汇总 */
export function calcQuotationSummary(input: QuotationCalcInput) {
  const itemResults = input.items.map((item) =>
    calcItemCost(item, input.exchangeRate, input.currency, input.profitMargin)
  );

  const totalSubtotal = round2(itemResults.reduce((s, r) => s + r.subtotalRmb, 0));
  const totalFinal = round2(itemResults.reduce((s, r) => s + r.finalPrice, 0));

  return { items: itemResults, totalSubtotal, totalFinal };
}

/** 生成报价单号 Q+YYYYMMDD+3位序列 */
export function formatQuotationNo(date: Date, sequence: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const seq = String(sequence).padStart(3, '0');
  return `Q${y}${m}${d}${seq}`;
}

/** 生成明细行号 MX+6位流水 */
export function formatItemNo(sequence: number): string {
  return `MX${String(sequence).padStart(6, '0')}`;
}
