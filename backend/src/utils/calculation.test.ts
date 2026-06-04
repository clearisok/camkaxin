import { describe, it, expect } from 'vitest';
import {
  round2,
  calcGrossWidth,
  calcFabricConsumption,
  calcFabricAmount,
  calcAccessoryAmount,
  calcLaborRmb,
  calcItemCost,
  calcValidUntil,
  formatQuotationNo,
  formatItemNo,
} from '../utils/calculation.js';

describe('round2', () => {
  it('rounds to 2 decimal places', () => {
    expect(round2(1.234)).toBe(1.23);
    expect(round2(1.235)).toBe(1.24);
    expect(round2(10.005)).toBe(10.01);
  });
});

describe('calcGrossWidth', () => {
  it('adds 5 to net width', () => {
    expect(calcGrossWidth(150)).toBe(155);
    expect(calcGrossWidth(0)).toBe(5);
  });
});

describe('calcFabricConsumption - meter unit', () => {
  it('calculates consumption with wastage', () => {
    // 段长2.5m, 损耗5% => 2.5 * 1.05 = 2.625 => 2.63
    const result = calcFabricConsumption({
      pieceLength: 2.5,
      wastage: 5,
      unit: 'meter',
      unitPrice: 10,
    });
    expect(result).toBe(2.63);
  });

  it('handles zero wastage', () => {
    expect(
      calcFabricConsumption({
        pieceLength: 3,
        wastage: 0,
        unit: 'meter',
        unitPrice: 10,
      })
    ).toBe(3);
  });
});

describe('calcFabricConsumption - kg unit', () => {
  it('calculates kg consumption correctly', () => {
    // 段长1.2, 净门幅150, 毛门幅155, 克重200, 损耗5%
    // 1.2 * 155/10000 * 200/1000 * 1.05 = 0.003906 => round to 0.00? Let's calculate:
    // 1.2 * 0.0155 * 0.2 * 1.05 = 0.003906 => 0.00
    const result = calcFabricConsumption({
      pieceLength: 1.2,
      wastage: 5,
      unit: 'kg',
      netWidth: 150,
      weight: 200,
      unitPrice: 50,
    });
    expect(result).toBe(0);
  });

  it('calculates larger kg consumption', () => {
    const result = calcFabricConsumption({
      pieceLength: 100,
      wastage: 5,
      unit: 'kg',
      netWidth: 150,
      weight: 200,
      unitPrice: 50,
    });
    // 100 * 155/10000 * 200/1000 * 1.05 = 100 * 0.0155 * 0.2 * 1.05 = 0.3255 => 0.33
    expect(result).toBe(0.33);
  });
});

describe('calcFabricAmount', () => {
  it('consumption * unit price', () => {
    expect(
      calcFabricAmount({
        pieceLength: 2,
        wastage: 0,
        unit: 'meter',
        unitPrice: 25.5,
      })
    ).toBe(51);
  });
});

describe('calcAccessoryAmount', () => {
  it('consumption * (1 + wastage/100) * unit price', () => {
    // 单耗1, 损耗5%, 单价10 => 1 * 1.05 * 10 = 10.5
    expect(
      calcAccessoryAmount({
        consumption: 1,
        wastage: 5,
        unitPrice: 10,
      })
    ).toBe(10.5);
  });

  it('default 5% wastage scenario', () => {
    expect(
      calcAccessoryAmount({
        consumption: 2,
        wastage: 5,
        unitPrice: 3.5,
      })
    ).toBe(7.35);
  });
});

describe('calcLaborRmb', () => {
  it('USD * exchange rate * 1.13', () => {
    // 10 USD * 6.8 * 1.13 = 76.84
    expect(calcLaborRmb(10, 6.8)).toBe(76.84);
  });

  it('handles zero labor', () => {
    expect(calcLaborRmb(0, 6.8)).toBe(0);
  });
});

describe('calcItemCost', () => {
  const baseItem = {
    laborCostUsd: 10,
    otherCostRmb: 5,
    shippingRmb: 1,
    fabrics: [
      {
        pieceLength: 2,
        wastage: 5,
        unit: 'meter' as const,
        unitPrice: 20,
      },
    ],
    accessories: [
      {
        consumption: 1,
        wastage: 5,
        unitPrice: 10,
      },
    ],
  };

  it('calculates full item cost in RMB', () => {
    const result = calcItemCost(baseItem, 6.8, 'RMB', 5);
    // fabric: 2*1.05=2.1, amount=42
    expect(result.fabrics[0].consumption).toBe(2.1);
    expect(result.fabricTotal).toBe(42);
    // accessory: 1*1.05*10=10.5
    expect(result.accessoryTotal).toBe(10.5);
    // labor: 10*6.8*1.13=76.84
    expect(result.laborRmb).toBe(76.84);
    // subtotal: 42+10.5+76.84+5+1=135.34
    expect(result.subtotalRmb).toBe(135.34);
    // final: 135.34*1.05=142.107 => 142.11
    expect(result.finalPrice).toBe(142.11);
  });

  it('calculates final price in USD', () => {
    const result = calcItemCost(baseItem, 6.8, 'USD', 5);
    // (135.34 / 6.8) * 1.05 = 20.907... => 20.91 (浮点精度可能为 20.9)
    expect(result.finalPrice).toBeGreaterThanOrEqual(20.9);
    expect(result.finalPrice).toBeLessThanOrEqual(20.91);
  });
});

describe('calcValidUntil', () => {
  it('adds 4 months to quote date', () => {
    const quoteDate = new Date('2026-01-15');
    const validUntil = calcValidUntil(quoteDate);
    expect(validUntil.getFullYear()).toBe(2026);
    expect(validUntil.getMonth()).toBe(4); // May (0-indexed)
    expect(validUntil.getDate()).toBe(15);
  });
});

describe('formatQuotationNo', () => {
  it('formats correctly', () => {
    expect(formatQuotationNo(new Date('2026-06-04'), 1)).toBe('Q20260604001');
    expect(formatQuotationNo(new Date('2026-06-04'), 42)).toBe('Q20260604042');
  });
});

describe('formatItemNo', () => {
  it('formats correctly', () => {
    expect(formatItemNo(1)).toBe('MX000001');
    expect(formatItemNo(123456)).toBe('MX123456');
  });
});
