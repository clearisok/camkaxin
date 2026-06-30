/** 项目统一使用北京时间（东八区，无夏令时） */
export const BEIJING_TZ = 'Asia/Shanghai';

const YMD_FORMATTER = new Intl.DateTimeFormat('en-CA', { timeZone: BEIJING_TZ });

const YMDHMS_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: BEIJING_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})/;

function partMap(parts: Intl.DateTimeFormatPart[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return map;
}

/** 将时刻格式化为北京日历日 YYYY-MM-DD */
export function formatYmdBeijing(date: Date = new Date()): string {
  if (Number.isNaN(date.getTime())) throw new Error('无效日期');
  return YMD_FORMATTER.format(date);
}

/** 北京今日 YYYY-MM-DD */
export function todayYmdBeijing(): string {
  return formatYmdBeijing(new Date());
}

/** 北京今日 YYYYMMDD（导出文件名等） */
export function todayYmdCompactBeijing(): string {
  return todayYmdBeijing().replace(/-/g, '');
}

/** 将时刻格式化为北京日期时间 YYYY-MM-DD HH:mm:ss */
export function formatDateTimeBeijing(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const p = partMap(YMDHMS_PARTS.formatToParts(date));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

/** 将数据库 date / ISO 字符串规范为北京日历日 */
export function toYmdBeijing(raw: string | Date | null | undefined): string | null {
  if (raw == null) return null;
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return formatYmdBeijing(raw);
  }
  const s = String(raw).trim();
  const match = YMD_RE.exec(s);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatYmdBeijing(parsed);
}

/** 在北京日历日上增减天数 */
export function addDaysYmdBeijing(baseYmd: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(baseYmd)) {
    throw new Error(`无效的日期基准: ${baseYmd}`);
  }
  const [y, m, d] = baseYmd.split('-').map(Number);
  // 正午北京时间 = 04:00 UTC（中国固定 UTC+8）
  const utcMs = Date.UTC(y, m - 1, d, 4, 0, 0) + days * 86_400_000;
  return formatYmdBeijing(new Date(utcMs));
}

/** 进程启动时设置 Node 默认时区为北京 */
export function ensureBeijingProcessTimezone(): void {
  process.env.TZ = BEIJING_TZ;
}
