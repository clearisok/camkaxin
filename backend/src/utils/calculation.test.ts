import { describe, it, expect } from 'vitest';
import {
  round2,
  calcGrossWidth,
  calcNetWidth,
  calcFabricConsumption,
  calcFabricAmount,
  calcAccessoryAmount,
  calcLaborRmb,
  calcItemCost,
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

describe('calcNetWidth', () => {
  it('subtracts 5 from gross width', () => {
    expect(calcNetWidth(155)).toBe(150);
    expect(calcNetWidth(5)).toBe(0);
    expect(calcNetWidth(3)).toBe(0);
  });
});

describe('calcFabricConsumption - meter unit', () => {
  it('converts piece length from cm to meters with wastage', () => {
    // 段长100cm => 1m, 损耗5% => 1 * 1.05 = 1.05
    const result = calcFabricConsumption({
      pieceLength: 100,
      wastage: 5,
      unit: 'meter',
      unitPrice: 10,
    });
    expect(result).toBe(1.05);
  });

  it('ignores gross width and weight for meter unit', () => {
    // 段长250cm => 2.5m, 损耗5% => 2.625 => 2.63
    const result = calcFabricConsumption({
      pieceLength: 250,
      wastage: 5,
      unit: 'meter',
      grossWidth: 155,
      weight: 200,
      unitPrice: 10,
    });
    expect(result).toBe(2.63);
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
  it('consumption * unit price for meter unit', () => {
    // 单耗 1.05 * 单价 28.5 = 29.925 => 29.93
    expect(
      calcFabricAmount({
        pieceLength: 100,
        wastage: 5,
        unit: 'meter',
        unitPrice: 28.5,
      })
    ).toBe(29.93);
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
        pieceLength: 100,
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
    expect(result.fabrics[0].consumption).toBe(1.05);
    expect(result.fabricTotal).toBe(21);
    expect(result.accessoryTotal).toBe(10.5);
    expect(result.laborRmb).toBe(76.84);
    expect(result.subtotalRmb).toBe(114.34);
    expect(result.finalPrice).toBe(120.06);
  });

  it('calculates final price in USD', () => {
    const result = calcItemCost(baseItem, 6.8, 'USD', 5);
    expect(result.finalPrice).toBe(17.66);
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
