import { describe, it, expect } from 'vitest';
import {
  calcUnscheduledQuantity,
  effectiveAllocatedQuantity,
  isAwaitingSchedule,
  isLegacyWholeRowSchedule,
} from '../services/styleAllocation.js';

describe('calcUnscheduledQuantity', () => {
  it('subtracts allocated from order quantity', () => {
    expect(calcUnscheduledQuantity(3560, 3199)).toBe(361);
    expect(calcUnscheduledQuantity(100, 150)).toBe(0);
  });

  it('returns 0 for invalid order quantity', () => {
    expect(calcUnscheduledQuantity(-1, 0)).toBe(0);
    expect(calcUnscheduledQuantity('x', 0)).toBe(0);
  });
});

describe('isLegacyWholeRowSchedule', () => {
  it('detects parent rows already in a production group', () => {
    expect(isLegacyWholeRowSchedule({
      parent_style_id: null,
      scheduling_zone: 'group',
      group_name: '11',
    })).toBe(true);

    expect(isLegacyWholeRowSchedule({
      parent_style_id: 1,
      scheduling_zone: 'group',
      group_name: '11',
    })).toBe(false);
  });
});

describe('effectiveAllocatedQuantity', () => {
  it('prefers child allocated sum when positive', () => {
    expect(effectiveAllocatedQuantity({ quantity: 1000 }, 300)).toBe(300);
  });

  it('falls back to legacy whole-row scheduled output', () => {
    expect(effectiveAllocatedQuantity({
      quantity: 1000,
      scheduled_output: 800,
      scheduling_zone: 'group',
      group_name: '6',
    }, 0)).toBe(800);
  });
});

describe('isAwaitingSchedule', () => {
  it('matches wait-zone parents with remaining unscheduled quantity', () => {
    expect(isAwaitingSchedule({
      parent_style_id: null,
      scheduling_zone: 'wait',
      unscheduled_quantity: 361,
    })).toBe(true);
  });

  it('rejects child rows, non-wait zones, and zero unscheduled', () => {
    expect(isAwaitingSchedule({
      parent_style_id: 10,
      scheduling_zone: 'wait',
      unscheduled_quantity: 5,
    })).toBe(false);

    expect(isAwaitingSchedule({
      scheduling_zone: 'group',
      group_name: '11',
      unscheduled_quantity: 5,
    })).toBe(false);

    expect(isAwaitingSchedule({
      scheduling_zone: 'wait',
      unscheduled_quantity: 0,
    })).toBe(false);
  });
});
