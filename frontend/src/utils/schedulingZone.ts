import type { StyleRecord } from '@/types/style';

export type SchedulingZone = 'wait' | 'group' | 'outsource' | 'offline';

export const PRODUCTION_GROUP_IDS = [
  ...Array.from({ length: 13 }, (_, i) => String(i + 1)),
  '15',
  '16',
];

export const ZONE_COLLAPSE_KEYS = {
  wait: 'wait',
  outsource: 'outsource',
  offline: 'offline',
  group: (id: string) => `group-${id}`,
} as const;

export const ALL_COLLAPSE_KEYS = [
  ZONE_COLLAPSE_KEYS.wait,
  ...PRODUCTION_GROUP_IDS.map((g) => ZONE_COLLAPSE_KEYS.group(g)),
  ZONE_COLLAPSE_KEYS.outsource,
  ZONE_COLLAPSE_KEYS.offline,
];

/** 展开全部时不包含下线区 */
export const EXPAND_ALL_COLLAPSE_KEYS = ALL_COLLAPSE_KEYS.filter(
  (k) => k !== ZONE_COLLAPSE_KEYS.offline,
);

export function groupLabel(row: StyleRecord): string {
  if (inferZone(row) === 'outsource' || row.is_outsourced) return '外发';
  if (row.group_name) return `第 ${row.group_name} 组`;
  return '—';
}

export function inferZone(row: StyleRecord): SchedulingZone {
  const z = row.scheduling_zone as SchedulingZone | undefined;
  if (z === 'wait' || z === 'group' || z === 'outsource' || z === 'offline') return z;
  const g = row.group_name?.trim();
  if (g === '外发') return 'outsource';
  if (g && PRODUCTION_GROUP_IDS.includes(g)) return 'group';
  return 'wait';
}

export function collapseKeyForRow(row: StyleRecord): string {
  const zone = inferZone(row);
  if (zone === 'group' && row.group_name) return ZONE_COLLAPSE_KEYS.group(row.group_name);
  return zone;
}

export function collapseLabel(key: string, count: number): string {
  if (key === 'wait') return `待排单（${count} 款）`;
  if (key === 'outsource') return `外发订单（${count} 款）`;
  if (key === 'offline') return `下线区（${count} 款）`;
  if (key.startsWith('group-')) return `第 ${key.slice(6)} 生产组（${count} 款）`;
  return `${key}（${count} 款）`;
}

export function isProductionGroupKey(key: string): boolean {
  return key.startsWith('group-');
}

/** 生产组摘要：品牌列表 + 组内最晚下线日 */
export function summarizeProductionGroup(rows: StyleRecord[]): {
  brands: string[];
  latestOfflineTime: string | null;
} {
  const brandSet = new Set<string>();
  let latest: string | null = null;
  for (const row of rows) {
    const brand = row.brand?.trim();
    if (brand) brandSet.add(brand);
    const offline = row.offline_time;
    if (!offline) continue;
    const ymd = String(offline).slice(0, 10);
    if (!latest || ymd > latest) latest = ymd;
  }
  return {
    brands: [...brandSet].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    latestOfflineTime: latest,
  };
}

export function formatMaterialText(fabric?: string | null, accessories?: string | null): string {
  const f = fabric?.trim();
  const a = accessories?.trim();
  if (f && a) return `${f} · ${a}`;
  return f || a || '';
}

export type MoveTarget = 'wait' | 'outsource' | 'offline' | `group:${string}`;

export function moveTargetValue(row: StyleRecord): string {
  const zone = inferZone(row);
  if (zone === 'group' && row.group_name) return `group:${row.group_name}`;
  return zone;
}

export function patchForMoveTarget(target: string): Record<string, unknown> {
  if (target === 'wait') return { scheduling_zone: 'wait', group_name: null };
  if (target === 'outsource') return { scheduling_zone: 'outsource', group_name: null, is_outsourced: true };
  if (target === 'offline') {
    const today = new Date().toISOString().slice(0, 10);
    return { scheduling_zone: 'offline', group_name: null, offline_time: today };
  }
  if (target.startsWith('group:')) {
    const g = target.slice(6);
    return { scheduling_zone: 'group', group_name: g, is_outsourced: false };
  }
  return { scheduling_zone: 'wait', group_name: null };
}

export const MOVE_TARGET_OPTIONS = [
  { value: 'wait', label: '待排单' },
  ...PRODUCTION_GROUP_IDS.map((g) => ({ value: `group:${g}`, label: `第 ${g} 组` })),
  { value: 'outsource', label: '外发订单' },
  { value: 'offline', label: '下线区' },
];
