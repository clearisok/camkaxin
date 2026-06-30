import { describe, expect, it } from 'vitest';
import {
  addDaysYmdBeijing,
  formatDateTimeBeijing,
  formatYmdBeijing,
  toYmdBeijing,
} from './beijingTime.js';

describe('beijingTime', () => {
  it('formats UTC instant as Beijing calendar day', () => {
    // 2026-06-07 18:00 UTC = 2026-06-08 02:00 北京
    const instant = new Date('2026-06-07T18:00:00.000Z');
    expect(formatYmdBeijing(instant)).toBe('2026-06-08');
  });

  it('parses YMD string without shifting', () => {
    expect(toYmdBeijing('2026-04-15')).toBe('2026-04-15');
  });

  it('adds days on Beijing calendar', () => {
    expect(addDaysYmdBeijing('2026-06-30', 1)).toBe('2026-07-01');
  });

  it('formats datetime in Beijing', () => {
    const text = formatDateTimeBeijing('2026-06-07T18:00:00.000Z');
    expect(text).toBe('2026-06-08 02:00:00');
  });
});
