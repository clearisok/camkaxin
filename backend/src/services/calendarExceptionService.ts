import { query, getClient } from '../config/database.js';
import { flattenCambodiaHolidays, cambodiaHolidayYears } from '../data/cambodiaHolidays.js';
import {
  expandPeriodToDates,
  formatPeriodLabel,
  groupConsecutiveToPeriods,
  normalizePeriod,
  periodDayCount,
} from '../utils/calendarPeriod.js';
import { defaultIsWorkdayYmd, isWorkdayYmd, weekdayBeijing } from '../utils/businessDays.js';
import { toYmdBeijing } from '../utils/beijingTime.js';
import { recalcAllProductionGroupsAfterCalendarChange } from './schedulingCalendarSync.js';

export type CalendarExceptionRow = {
  id: number;
  start_date: string;
  end_date: string;
  day_type: 'holiday' | 'workday';
  name: string | null;
  source: 'manual' | 'cambodia';
  created_at: string;
  updated_at: string;
  day_count?: number;
  period_label?: string;
  weekday_start?: string;
  weekday_end?: string;
  effective_workday?: boolean;
};

export interface CalendarExceptionInput {
  start_date: string;
  end_date?: string;
  day_type: 'holiday' | 'workday';
  name?: string | null;
}

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function rowToApi(row: Record<string, unknown>): CalendarExceptionRow {
  const start = toYmdBeijing(row.start_date as string | Date) ?? String(row.start_date);
  const end = toYmdBeijing(row.end_date as string | Date) ?? start;
  return {
    id: Number(row.id),
    start_date: start,
    end_date: end,
    day_type: row.day_type as 'holiday' | 'workday',
    name: (row.name as string | null) ?? null,
    source: row.source as 'manual' | 'cambodia',
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    day_count: periodDayCount(start, end),
    period_label: formatPeriodLabel(start, end),
    weekday_start: WEEKDAY_LABELS[weekdayBeijing(start)],
    weekday_end: WEEKDAY_LABELS[weekdayBeijing(end)],
  };
}

function yearBounds(year: number) {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export async function listCalendarExceptions(params: { year?: number }) {
  let sql = 'SELECT * FROM calendar_exceptions';
  const values: unknown[] = [];
  if (params.year) {
    const { from, to } = yearBounds(params.year);
    sql += ' WHERE start_date <= $2::date AND end_date >= $1::date';
    values.push(from, to);
  }
  sql += ' ORDER BY start_date ASC, end_date ASC, id ASC';
  const result = await query(sql, values);
  return result.rows.map((r) => rowToApi(r as Record<string, unknown>));
}

export async function getCalendarExceptionById(id: number) {
  const result = await query('SELECT * FROM calendar_exceptions WHERE id = $1', [id]);
  if (!result.rows[0]) return null;
  return rowToApi(result.rows[0] as Record<string, unknown>);
}

export async function createCalendarException(input: CalendarExceptionInput) {
  const { start_date, end_date } = normalizePeriod(input.start_date, input.end_date);
  if (input.day_type !== 'holiday' && input.day_type !== 'workday') {
    throw new Error('day_type 须为 holiday 或 workday');
  }
  const result = await query(
    `INSERT INTO calendar_exceptions (start_date, end_date, day_type, name, source, updated_at)
     VALUES ($1::date, $2::date, $3, $4, 'manual', NOW())
     RETURNING *`,
    [start_date, end_date, input.day_type, input.name?.trim() || null],
  );
  const row = rowToApi(result.rows[0] as Record<string, unknown>);
  await recalcAllProductionGroupsAfterCalendarChange('calendar-create');
  return row;
}

export async function updateCalendarException(id: number, input: Partial<CalendarExceptionInput>) {
  const existing = await getCalendarExceptionById(id);
  if (!existing) throw new Error('记录不存在');

  const startRaw = input.start_date ?? existing.start_date;
  const endRaw = input.end_date ?? input.start_date ?? existing.end_date;
  const { start_date, end_date } = normalizePeriod(startRaw, endRaw);
  const dayType = input.day_type ?? existing.day_type;
  const name = input.name !== undefined ? (input.name?.trim() || null) : existing.name;

  const result = await query(
    `UPDATE calendar_exceptions SET
      start_date = $1::date,
      end_date = $2::date,
      day_type = $3,
      name = $4,
      source = 'manual',
      updated_at = NOW()
     WHERE id = $5 RETURNING *`,
    [start_date, end_date, dayType, name, id],
  );
  const row = rowToApi(result.rows[0] as Record<string, unknown>);
  await recalcAllProductionGroupsAfterCalendarChange('calendar-update');
  return row;
}

export async function deleteCalendarException(id: number) {
  const result = await query('DELETE FROM calendar_exceptions WHERE id = $1 RETURNING id', [id]);
  const ok = (result.rowCount ?? 0) > 0;
  if (ok) {
    await recalcAllProductionGroupsAfterCalendarChange('calendar-delete');
  }
  return ok;
}

/** 同步柬埔寨法定节假日（按连续同名日期合并为时间段） */
export async function syncCambodiaHolidays(years?: number[]) {
  const entries = flattenCambodiaHolidays(years);
  const periods = groupConsecutiveToPeriods(
    entries.map((e) => ({ date: e.date, name: e.name })),
  );
  const targetYears = years?.length ? years : cambodiaHolidayYears();
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM calendar_exceptions
       WHERE source = 'cambodia'
         AND EXTRACT(YEAR FROM start_date) = ANY($1::int[])`,
      [targetYears],
    );
    let inserted = 0;
    for (const period of periods) {
      const year = Number(period.start_date.slice(0, 4));
      if (!targetYears.includes(year)) continue;
      await client.query(
        `INSERT INTO calendar_exceptions (start_date, end_date, day_type, name, source, updated_at)
         VALUES ($1::date, $2::date, 'holiday', $3, 'cambodia', NOW())`,
        [period.start_date, period.end_date, period.name],
      );
      inserted += 1;
    }
    await client.query('COMMIT');
    await recalcAllProductionGroupsAfterCalendarChange('sync-cambodia-holidays');
    return { inserted, years: targetYears };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

function expandRowsToDayMap(
  rows: Array<{ start_date: Date | string; end_date: Date | string; day_type: string }>,
): Map<string, 'holiday' | 'workday'> {
  const map = new Map<string, 'holiday' | 'workday'>();
  for (const row of rows) {
    const start = toYmdBeijing(row.start_date);
    const end = toYmdBeijing(row.end_date);
    if (!start || !end) continue;
    if (row.day_type !== 'holiday' && row.day_type !== 'workday') continue;
    for (const ymd of expandPeriodToDates(start, end)) {
      map.set(ymd, row.day_type);
    }
  }
  return map;
}

export async function loadExceptionMapForRange(fromYmd: string, toYmd: string) {
  const result = await query<{ start_date: Date; end_date: Date; day_type: string }>(
    `SELECT start_date, end_date, day_type FROM calendar_exceptions
     WHERE start_date <= $2::date AND end_date >= $1::date`,
    [fromYmd, toYmd],
  );
  return expandRowsToDayMap(result.rows);
}

export async function listCalendarWithEffective(params: { year: number }) {
  const rows = await listCalendarExceptions({ year: params.year });
  return rows.map((row) => ({
    ...row,
    default_workday: defaultIsWorkdayYmd(row.start_date),
    effective_workday: row.day_type === 'workday',
  }));
}

export function getCalendarRulesSummary() {
  return {
    base_rule: '周一至周六为工作日，周日休息',
    timezone: 'Asia/Shanghai',
    cambodia_years_available: cambodiaHolidayYears(),
  };
}

/** 供排单等服务加载全部日历例外（按日展开） */
export async function loadAllExceptionsMap() {
  const result = await query<{ start_date: Date; end_date: Date; day_type: string }>(
    'SELECT start_date, end_date, day_type FROM calendar_exceptions',
  );
  return expandRowsToDayMap(result.rows);
}

/** 判断某日是否上班（默认规则 + 全部例外） */
export async function isWorkdayOnDate(ymd: string): Promise<boolean> {
  const map = await loadAllExceptionsMap();
  return isWorkdayYmd(ymd, map);
}
