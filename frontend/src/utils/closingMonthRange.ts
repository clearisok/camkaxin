import { beijingNow, parseBeijingDate } from '@/utils/beijingTime';

export interface ClosingMonthRange {
  startMonth: string;
  endMonth: string;
}

function parseYm(ym: string) {
  return parseBeijingDate(`${ym}-01`).startOf('month');
}

/** 默认：上个月起共 6 个月（含上个月 + 随后 5 个月） */
export function defaultClosingMonthRange(): ClosingMonthRange {
  const start = beijingNow().subtract(1, 'month');
  return {
    startMonth: start.format('YYYY-MM'),
    endMonth: start.add(5, 'month').format('YYYY-MM'),
  };
}

export function expandMonthRange(startMonth: string, endMonth: string): string[] {
  let start = parseYm(startMonth);
  let end = parseYm(endMonth);
  if (end.isBefore(start)) {
    const tmp = start;
    start = end;
    end = tmp;
  }
  const months: string[] = [];
  let cur = start;
  while (!cur.isAfter(end)) {
    months.push(cur.format('YYYY-MM'));
    cur = cur.add(1, 'month');
  }
  return months;
}

export function closingMonthRangeToCsv(range: ClosingMonthRange): string {
  return expandMonthRange(range.startMonth, range.endMonth).join(',');
}

export function normalizeClosingMonthRange(startMonth: string, endMonth: string): ClosingMonthRange {
  const months = expandMonthRange(startMonth, endMonth);
  return {
    startMonth: months[0] ?? startMonth,
    endMonth: months[months.length - 1] ?? endMonth,
  };
}
