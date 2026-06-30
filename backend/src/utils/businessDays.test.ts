import { describe, expect, it } from 'vitest';
import {
  addBusinessDaysYmd,
  countNonWorkdaysInScheduleSpan,
  countWorkdaysForSchedule,
  defaultIsWorkdayYmd,
  isOverdueForOfflineNotification,
  isWorkdayYmd,
  offlineFromOnlineAndWorkdaysYmd,
  subtractBusinessDaysYmd,
} from './businessDays.js';

describe('businessDays', () => {
  it('default: Mon-Sat work, Sun rest', () => {
    expect(defaultIsWorkdayYmd('2026-06-08')).toBe(true); // Mon
    expect(defaultIsWorkdayYmd('2026-06-07')).toBe(false); // Sun
  });

  it('holiday override on weekday', () => {
    const ex = new Map([['2026-06-08', 'holiday' as const]]);
    expect(isWorkdayYmd('2026-06-08', ex)).toBe(false);
  });

  it('workday override on Sunday', () => {
    const ex = new Map([['2026-06-07', 'workday' as const]]);
    expect(isWorkdayYmd('2026-06-07', ex)).toBe(true);
  });

  it('addBusinessDays skips weekend and holiday', () => {
    const ex = new Map([['2026-06-09', 'holiday' as const]]);
    // 2026-06-08 Mon + 1 business day with Tue holiday -> Wed 10
    expect(addBusinessDaysYmd('2026-06-08', 1, ex)).toBe('2026-06-10');
  });

  it('required_days includes online and offline (closed interval)', () => {
    const ex = new Map<string, 'holiday' | 'workday'>();
    const online = '2026-06-08'; // Mon
    const offline = offlineFromOnlineAndWorkdaysYmd(online, 3, ex);
    expect(offline).toBe('2026-06-10'); // Mon–Wed
    expect(countWorkdaysForSchedule(online, offline, ex)).toBe(3);
    expect(subtractBusinessDaysYmd(offline, 3, ex)).toBe(online);
  });

  it('required_days=1: offline equals online on workday', () => {
    const ex = new Map<string, 'holiday' | 'workday'>();
    expect(offlineFromOnlineAndWorkdaysYmd('2026-06-08', 1, ex)).toBe('2026-06-08');
  });

  it('offline notification: offline date before today is overdue', () => {
    const ex = new Map<string, 'holiday' | 'workday'>();
    expect(isOverdueForOfflineNotification('2026-06-07', '2026-06-08', ex)).toBe(true);
    expect(isOverdueForOfflineNotification('2026-06-08', '2026-06-08', ex)).toBe(false);
    expect(isOverdueForOfflineNotification('2026-06-09', '2026-06-08', ex)).toBe(false);
  });

  it('countNonWorkdaysInScheduleSpan includes Sundays in span', () => {
    const ex = new Map<string, 'holiday' | 'workday'>();
    const n = countNonWorkdaysInScheduleSpan('2026-06-17', '2026-06-22', ex);
    expect(n).toBe(1);
  });
});
