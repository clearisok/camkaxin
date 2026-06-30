import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

/** 项目统一使用北京时间（东八区） */
export const BEIJING_TZ = 'Asia/Shanghai';

/** 当前北京时间 */
export function beijingNow() {
  return dayjs().tz(BEIJING_TZ);
}

/** 北京今日 YYYY-MM-DD */
export function todayYmd(): string {
  return beijingNow().format('YYYY-MM-DD');
}

/** 北京当月 YYYY-MM */
export function todayYm(): string {
  return beijingNow().format('YYYY-MM');
}

/** 北京今日 YYYYMMDD */
export function todayYmdCompact(): string {
  return beijingNow().format('YYYYMMDD');
}

/** 将时间戳/ISO 格式化为北京日期时间 */
export function formatDateTimeBeijing(value: string | Date): string {
  return dayjs(value).tz(BEIJING_TZ).format('YYYY-MM-DD HH:mm:ss');
}

/** 解析日期字符串为北京时区的 dayjs 实例 */
export function parseBeijingDate(value: string) {
  return dayjs.tz(value, BEIJING_TZ);
}

/** 格式化为北京日历日 YYYY-MM-DD（不含时分秒） */
export function formatDateBeijing(value?: string | Date | null): string {
  if (value == null || value === '') return '—';
  const d = dayjs(value);
  if (!d.isValid()) return '—';
  return d.tz(BEIJING_TZ).format('YYYY-MM-DD');
}

/** 导出/比较用：无效则返回空字符串 */
export function toYmdBeijingClient(value?: string | Date | null): string {
  if (value == null || value === '') return '';
  const d = dayjs(value);
  if (!d.isValid()) return '';
  return d.tz(BEIJING_TZ).format('YYYY-MM-DD');
}

export const STYLE_DATE_FIELD_KEYS = new Set([
  'required_shipping_date',
  'online_time',
  'offline_time',
  'first_bed_time',
  'created_at',
  'updated_at',
]);
