import { describe, expect, it } from 'vitest';
import {
  expandPeriodToDates,
  groupConsecutiveToPeriods,
  normalizePeriod,
  periodDayCount,
} from './calendarPeriod.js';

describe('calendarPeriod', () => {
  it('expands inclusive range', () => {
    expect(expandPeriodToDates('2026-04-14', '2026-04-16')).toEqual([
      '2026-04-14', '2026-04-15', '2026-04-16',
    ]);
  });

  it('normalizes single day', () => {
    expect(normalizePeriod('2026-05-01')).toEqual({
      start_date: '2026-05-01',
      end_date: '2026-05-01',
    });
  });

  it('groups consecutive same-name dates', () => {
    const grouped = groupConsecutiveToPeriods([
      { date: '2026-04-14', name: '柬新年' },
      { date: '2026-04-15', name: '柬新年' },
      { date: '2026-04-16', name: '柬新年' },
      { date: '2026-05-01', name: '劳动节' },
    ]);
    expect(grouped).toEqual([
      { start_date: '2026-04-14', end_date: '2026-04-16', name: '柬新年' },
      { start_date: '2026-05-01', end_date: '2026-05-01', name: '劳动节' },
    ]);
    expect(periodDayCount('2026-04-14', '2026-04-16')).toBe(3);
  });
});
