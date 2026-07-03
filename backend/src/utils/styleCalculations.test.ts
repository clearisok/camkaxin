import { describe, it, expect } from 'vitest';
import {
  calcDays,
  calcOutputRatio,
  calcProcessingOutputValue,
  calcSalesOutputValue,
  enrichStyle,
  isUnscheduled,
} from './styleCalculations.js';

describe('calcProcessingOutputValue', () => {
  it('multiplies quantity and unit price rounded to 2 decimals', () => {
    expect(calcProcessingOutputValue(1000, 1.235)).toBe(1235);
    expect(calcProcessingOutputValue(3560, 0.3)).toBe(1068);
  });

  it('returns null for invalid inputs', () => {
    expect(calcProcessingOutputValue(null, 1)).toBeNull();
    expect(calcProcessingOutputValue(100, undefined)).toBeNull();
  });
});

describe('calcSalesOutputValue', () => {
  it('multiplies quantity and sales price', () => {
    expect(calcSalesOutputValue(100, 26.7)).toBe(2670);
  });
});

describe('calcOutputRatio', () => {
  it('divides scheduled output by daily average', () => {
    expect(calcOutputRatio(3199, 213)).toBe(15.02);
  });

  it('returns null when avg is zero', () => {
    expect(calcOutputRatio(100, 0)).toBeNull();
  });
});

describe('calcDays', () => {
  it('counts inclusive calendar days between online and offline', () => {
    expect(calcDays('2026-09-29', '2026-10-16')).toBe(17);
  });
});

describe('enrichStyle', () => {
  it('computes derived fields for parent style', () => {
    const row = enrichStyle({
      quantity: 1000,
      processing_unit_price: 1.07,
      sales_price: 26.7,
      scheduled_output: 3199,
      avg_daily_output: 213,
      online_time: '2026-09-29',
      offline_time: '2026-10-16',
    });

    expect(row.processing_output_value).toBe(1070);
    expect(row.sales_output_value).toBe(26700);
    expect(row.output_ratio).toBe(15.02);
    expect(row.days).toBe(17);
  });

  it('nulls output values for child styles', () => {
    const row = enrichStyle({
      parent_style_id: 99,
      quantity: 1000,
      processing_unit_price: 1,
      sales_price: 10,
    });

    expect(row.processing_output_value).toBeNull();
    expect(row.sales_output_value).toBeNull();
  });
});

describe('isUnscheduled', () => {
  it('is true for wait-zone parent with unscheduled quantity', () => {
    expect(isUnscheduled({
      parent_style_id: null,
      scheduling_zone: 'wait',
      unscheduled_quantity: 10,
    })).toBe(true);
  });

  it('is false for child rows or zero unscheduled', () => {
    expect(isUnscheduled({
      parent_style_id: 1,
      scheduling_zone: 'wait',
      unscheduled_quantity: 10,
    })).toBe(false);

    expect(isUnscheduled({
      scheduling_zone: 'wait',
      unscheduled_quantity: 0,
    })).toBe(false);

    expect(isUnscheduled({
      scheduling_zone: 'group',
      group_name: '11',
      unscheduled_quantity: 5,
    })).toBe(false);
  });
});
