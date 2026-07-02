import { addDaysYmdBeijing, toYmdBeijing } from './beijingTime.js';

export interface DatePeriod {
  start_date: string;
  end_date: string;
}

/** 展开时间段为逐日 YMD 列表（含起止） */
export function expandPeriodToDates(startYmd: string, endYmd: string): string[] {
  if (startYmd > endYmd) return [];
  const dates: string[] = [];
  let cur = startYmd;
  let guard = 0;
  while (cur <= endYmd) {
    dates.push(cur);
    cur = addDaysYmdBeijing(cur, 1);
    guard += 1;
    if (guard > 366 * 5) throw new Error('时间段过长');
  }
  return dates;
}

export function periodDayCount(startYmd: string, endYmd: string): number {
  return expandPeriodToDates(startYmd, endYmd).length;
}

export function normalizePeriod(start: unknown, end?: unknown): DatePeriod {
  const startInput = start as string | Date | null | undefined;
  const endInput = (end != null ? end : start) as string | Date | null | undefined;
  const startYmd = toYmdBeijing(startInput);
  const endYmd = toYmdBeijing(endInput);
  if (!startYmd || !endYmd) throw new Error('无效的日期');
  if (startYmd > endYmd) throw new Error('开始日期不能晚于结束日期');
  return { start_date: startYmd, end_date: endYmd };
}

/** 将同名连续单日合并为时间段 */
export function groupConsecutiveToPeriods(
  entries: Array<{ date: string; name: string }>,
): Array<DatePeriod & { name: string }> {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  const result: Array<DatePeriod & { name: string }> = [];
  let cur = { start_date: sorted[0].date, end_date: sorted[0].date, name: sorted[0].name };
  for (let i = 1; i < sorted.length; i += 1) {
    const e = sorted[i];
    const nextDay = addDaysYmdBeijing(cur.end_date, 1);
    if (e.name === cur.name && e.date === nextDay) {
      cur.end_date = e.date;
    } else {
      result.push({ ...cur });
      cur = { start_date: e.date, end_date: e.date, name: e.name };
    }
  }
  result.push(cur);
  return result;
}

export function formatPeriodLabel(start: string, end: string): string {
  return start === end ? start : `${start} ~ ${end}`;
}
