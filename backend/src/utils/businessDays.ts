import { addDaysYmdBeijing, toYmdBeijing } from './beijingTime.js';

export type CalendarDayType = 'holiday' | 'workday';
export type CalendarExceptionMap = Map<string, CalendarDayType>;

/** 北京日历日的星期（0=周日 … 6=周六） */
export function weekdayBeijing(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 4, 0, 0)).getUTCDay();
}

/** 默认规则：周一至周六工作，周日休息 */
export function defaultIsWorkdayYmd(ymd: string): boolean {
  const dow = weekdayBeijing(ymd);
  return dow >= 1 && dow <= 6;
}

export function isWorkdayYmd(ymd: string, exceptions: CalendarExceptionMap): boolean {
  const ex = exceptions.get(ymd);
  if (ex === 'holiday') return false;
  if (ex === 'workday') return true;
  return defaultIsWorkdayYmd(ymd);
}

/** 从 startYmd 起（不含当天）累计 businessDays 个工作日 */
export function addBusinessDaysYmd(
  startYmd: string,
  businessDays: number,
  exceptions: CalendarExceptionMap,
): string {
  if (businessDays < 0) throw new Error('businessDays 不能为负');
  if (businessDays === 0) return startYmd;
  let current = startYmd;
  let remaining = businessDays;
  let guard = 0;
  while (remaining > 0) {
    current = addDaysYmdBeijing(current, 1);
    guard += 1;
    if (guard > 366 * 3) throw new Error('工作日计算超出范围');
    if (isWorkdayYmd(current, exceptions)) remaining -= 1;
  }
  return current;
}

/** 下一工作日（含当天若已是工作日则返回当天） */
export function nextWorkdayYmd(fromYmd: string, exceptions: CalendarExceptionMap): string {
  let current = fromYmd;
  let guard = 0;
  while (!isWorkdayYmd(current, exceptions)) {
    current = addDaysYmdBeijing(current, 1);
    guard += 1;
    if (guard > 14) throw new Error('14 天内未找到工作日');
  }
  return current;
}

/** 上一单下线 + 1 个工作日 → 下一单上线 */
export function nextOnlineAfterOfflineYmd(
  offlineYmd: string,
  exceptions: CalendarExceptionMap,
): string {
  return addBusinessDaysYmd(offlineYmd, 1, exceptions);
}

/** [online, offline] 含两端：从 online 起累计 requiredDays 个工作日得 offline */
export function offlineFromOnlineAndWorkdaysYmd(
  onlineYmd: string,
  requiredDays: number,
  exceptions: CalendarExceptionMap,
): string {
  if (requiredDays < 1) throw new Error('requiredDays 须 >= 1');
  let cur = onlineYmd;
  let count = 0;
  let guard = 0;
  while (count < requiredDays) {
    if (isWorkdayYmd(cur, exceptions)) count += 1;
    if (count < requiredDays) {
      cur = addDaysYmdBeijing(cur, 1);
      guard += 1;
      if (guard > 366 * 3) throw new Error('工作日计算超出范围');
    }
  }
  return cur;
}

/** [online, offline] 区间内工作日数（含上线、下线当天），与 offlineFromOnlineAndWorkdaysYmd 互逆 */
export function countWorkdaysForSchedule(
  onlineYmd: string,
  offlineYmd: string,
  exceptions: CalendarExceptionMap,
): number {
  if (offlineYmd < onlineYmd) throw new Error('下线时间不能早于上线时间');
  let count = 0;
  let cur = onlineYmd;
  let guard = 0;
  while (cur <= offlineYmd) {
    if (isWorkdayYmd(cur, exceptions)) count += 1;
    cur = addDaysYmdBeijing(cur, 1);
    guard += 1;
    if (guard > 366 * 3) throw new Error('工作日计数超出范围');
  }
  return count;
}

/** 已知 offline 与工作日天数，反推 online（[online, offline] 含两端，互逆） */
export function subtractBusinessDaysYmd(
  offlineYmd: string,
  businessDays: number,
  exceptions: CalendarExceptionMap,
): string {
  if (businessDays < 1) throw new Error('businessDays 须 >= 1');
  let online = offlineYmd;
  let count = 0;
  let guard = 0;
  while (count < businessDays) {
    if (isWorkdayYmd(online, exceptions)) count += 1;
    if (count < businessDays) {
      online = addDaysYmdBeijing(online, -1);
      guard += 1;
      if (guard > 366 * 3) throw new Error('反推上线日超出范围');
    }
  }
  return online;
}

/** 下线通知：下线日已过（严格早于今天） */
export function isOverdueForOfflineNotification(
  offlineYmd: string,
  todayYmd: string,
  _exceptions?: CalendarExceptionMap,
): boolean {
  return offlineYmd < todayYmd;
}

/** [online, offline] 区间内非工作日数（含上线、下线当天；含周日、假期表 holiday） */
export function countNonWorkdaysInScheduleSpan(
  onlineYmd: string,
  offlineYmd: string,
  exceptions: CalendarExceptionMap,
): number {
  if (!onlineYmd || !offlineYmd || offlineYmd < onlineYmd) return 0;
  let count = 0;
  let cur = onlineYmd;
  let guard = 0;
  while (cur <= offlineYmd) {
    if (!isWorkdayYmd(cur, exceptions)) count += 1;
    cur = addDaysYmdBeijing(cur, 1);
    guard += 1;
    if (guard > 366 * 3) throw new Error('非工作日计数超出范围');
  }
  return count;
}

export function exceptionsMapFromRows(
  rows: Array<{
    exception_date?: string | Date;
    start_date?: string | Date;
    end_date?: string | Date;
    day_type: string;
  }>,
): CalendarExceptionMap {
  const map: CalendarExceptionMap = new Map();
  for (const row of rows) {
    if (row.day_type !== 'holiday' && row.day_type !== 'workday') continue;
    const start = toYmdBeijing(row.start_date ?? row.exception_date);
    const end = toYmdBeijing(row.end_date ?? row.start_date ?? row.exception_date);
    if (!start || !end) continue;
    let cur = start;
    while (cur <= end) {
      map.set(cur, row.day_type);
      cur = addDaysYmdBeijing(cur, 1);
    }
  }
  return map;
}
