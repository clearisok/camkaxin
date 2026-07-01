import {
  addDaysYmdBeijing,
  todayYmdBeijing,
  toYmdBeijing,
} from './beijingTime.js';

export type SchedulingZone = 'wait' | 'group' | 'outsource' | 'offline';

export const PRODUCTION_GROUP_IDS = [
  ...Array.from({ length: 13 }, (_, i) => String(i + 1)),
  '15',
  '16',
];

/** 排单 Excel 导出区位顺序（不含下线区、不含 14 组） */
export const SCHEDULING_EXPORT_ZONE_ORDER = [
  'wait',
  ...PRODUCTION_GROUP_IDS.map((g) => `group-${g}`),
  'outsource',
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

export function collapseKeyForRow(row: {
  scheduling_zone?: string | null;
  group_name?: string | null;
}): string {
  const zone = inferZoneFromRow(row);
  if (zone === 'group' && row.group_name) return `group-${String(row.group_name).trim()}`;
  return zone;
}

/** 排单导出虚拟列：区位显示名 */
export function schedulingZoneLabel(row: {
  scheduling_zone?: string | null;
  group_name?: string | null;
}): string {
  const key = collapseKeyForRow(row);
  if (key === 'wait') return '待排单';
  if (key === 'outsource') return '外发订单';
  if (key === 'offline') return '下线区';
  if (key.startsWith('group-')) return `第 ${key.slice(6)} 生产组`;
  return key;
}

export function zoneKeyLabel(key: string): string {
  if (key === 'wait') return '待排单';
  if (key === 'outsource') return '外发订单';
  if (key === 'offline') return '下线区';
  if (key.startsWith('group-')) return `第 ${key.slice(6)} 生产组`;
  return key;
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

/** 将数据库 date / ISO 字符串规范为北京日历日 YYYY-MM-DD */
export function toYmd(raw: string | Date | null | undefined): string | null {
  return toYmdBeijing(raw);
}

export function todayYmd(): string {
  return todayYmdBeijing();
}

export function addDaysYmd(baseYmd: string, days: number): string {
  return addDaysYmdBeijing(baseYmd, days);
}
