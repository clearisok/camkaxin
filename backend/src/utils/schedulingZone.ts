export type SchedulingZone = 'wait' | 'group' | 'outsource' | 'offline';

export const PRODUCTION_GROUP_IDS = [
  ...Array.from({ length: 13 }, (_, i) => String(i + 1)),
  '15',
  '16',
];

const VALID_ZONES = new Set<SchedulingZone>(['wait', 'group', 'outsource', 'offline']);

export function isProductionGroup(name?: string | null): boolean {
  return !!name && PRODUCTION_GROUP_IDS.includes(name);
}

export function inferZoneFromRow(row: {
  scheduling_zone?: string | null;
  group_name?: string | null;
}): SchedulingZone {
  const z = row.scheduling_zone as SchedulingZone | undefined;
  if (z && VALID_ZONES.has(z)) return z;
  const g = row.group_name?.trim();
  if (g === '外发') return 'outsource';
  if (g && isProductionGroup(g)) return 'group';
  return 'wait';
}

export function normalizeZonePatch(patch: Record<string, unknown>): Record<string, unknown> {
  const next = { ...patch };
  if ('scheduling_zone' in next) {
    const zone = next.scheduling_zone as SchedulingZone;
    if (!VALID_ZONES.has(zone)) {
      throw new Error('无效的 scheduling_zone');
    }
    if (zone === 'group') {
      const g = String(next.group_name ?? '').trim();
      if (!isProductionGroup(g)) {
        throw new Error('group 区位必须指定有效组号（1-13、15、16）');
      }
      next.group_name = g;
      next.is_outsourced = false;
    } else {
      next.group_name = null;
      if (zone === 'outsource') next.is_outsourced = true;
      if (zone === 'wait') next.is_outsourced = false;
    }
  } else if ('group_name' in next) {
    const g = next.group_name == null || next.group_name === '' ? null : String(next.group_name).trim();
    if (!g) {
      next.scheduling_zone = 'wait';
      next.group_name = null;
    } else if (g === '外发') {
      next.scheduling_zone = 'outsource';
      next.group_name = null;
      next.is_outsourced = true;
    } else if (isProductionGroup(g)) {
      next.scheduling_zone = 'group';
      next.group_name = g;
      next.is_outsourced = false;
    }
  }
  return next;
}

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/** 将数据库 date / ISO 字符串规范为 YYYY-MM-DD（使用本地日历日，避免 Date#toString 截断） */
export function toYmd(raw: string | Date | null | undefined): string | null {
  if (raw == null) return null;
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(raw).trim();
  const match = YMD_RE.exec(s);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return null;
  return toYmd(parsed);
}

export function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDaysYmd(baseYmd: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(baseYmd)) {
    throw new Error(`无效的日期基准: ${baseYmd}`);
  }
  const d = new Date(`${baseYmd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
