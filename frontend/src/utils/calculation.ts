import dayjs from 'dayjs';

export type FabricUnit = 'meter' | 'kg';

export interface FabricInput {
  pieceLength: number;
  wastage: number;
  unit: FabricUnit;
  netWidth?: number;
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

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calcGrossWidth(netWidth: number): number {
  return netWidth + 5;
}

export function calcFabricConsumption(fabric: FabricInput): number {
  const { pieceLength, wastage, unit, netWidth = 0, weight = 0 } = fabric;
  const wastageFactor = 1 + wastage / 100;

  if (unit === 'meter') {
    return round2(pieceLength * wastageFactor);
  }

  const grossWidth = calcGrossWidth(netWidth);
  return round2(pieceLength * (grossWidth / 10000) * (weight / 1000) * wastageFactor);
}

export function calcAccessoryAmount(accessory: AccessoryInput): number {
  const wastageFactor = 1 + accessory.wastage / 100;
  return round2(accessory.consumption * wastageFactor * accessory.unitPrice);
}

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
  const accessoryTotal = round2(accessoryResults.reduce((sum, a) => sum + a.amount, 0));
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

  return { fabricTotal, accessoryTotal, laborRmb, subtotalRmb, finalPrice, fabrics: fabricResults, accessories: accessoryResults };
}

export function calcValidUntil(quoteDate: dayjs.Dayjs): dayjs.Dayjs {
  return quoteDate.add(4, 'month');
}
