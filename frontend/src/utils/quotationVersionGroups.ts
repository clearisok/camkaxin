import type { CSSProperties } from 'react';
import type { QuotationItem } from '@/types';
import { getVersionTagColor } from '@/utils/quotationProductCode';

export interface VersionRowDraft {
  version_label: string;
  quantity?: number;
  labor_cost_usd?: number;
}

export interface VersionGroup {
  groupKey: string;
  indices: number[];
}

export function newVersionGroupKey(): string {
  return `vg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** 加载后为明细补全版本组 key（兼容旧数据） */
export function ensureVersionGroupKeys(items: QuotationItem[]): QuotationItem[] {
  const result = items.map((item) => ({ ...item }));
  let i = 0;
  while (i < result.length) {
    if (result[i].version_group_key) {
      i += 1;
      continue;
    }
    const code = result[i].product_code?.trim() || '';
    const key = newVersionGroupKey();
    result[i].version_group_key = key;
    let j = i + 1;
    while (j < result.length) {
      const next = result[j];
      const nextCode = next.product_code?.trim() || '';
      const prevHasVersion = !!result[j - 1].version_label?.trim();
      const nextHasVersion = !!next.version_label?.trim();
      if (nextCode === code && (prevHasVersion || nextHasVersion)) {
        next.version_group_key = key;
        j += 1;
      } else {
        break;
      }
    }
    i = j;
  }
  return result;
}

export function buildVersionGroups(items: QuotationItem[]): VersionGroup[] {
  const groups: VersionGroup[] = [];
  const seen = new Map<string, VersionGroup>();
  items.forEach((item, index) => {
    const key = item.version_group_key || `orphan-${index}`;
    let group = seen.get(key);
    if (!group) {
      group = { groupKey: key, indices: [] };
      seen.set(key, group);
      groups.push(group);
    }
    group.indices.push(index);
  });
  return groups;
}

export function cloneItemFromSource(source: QuotationItem, patch: Partial<QuotationItem>): QuotationItem {
  return {
    ...source,
    id: undefined,
    fabrics: (source.fabrics || []).map((f) => ({ ...f })),
    accessories: (source.accessories || []).map((a) => ({ ...a })),
    pattern_files: [...(source.pattern_files || [])],
    layout_files: [...(source.layout_files || [])],
    sample_images: [...(source.sample_images || [])],
    sample_videos: [...(source.sample_videos || [])],
    quantity_tiers: [],
    ...patch,
  };
}

export function stripClientItemFields(item: QuotationItem): QuotationItem {
  const { version_group_key: _gk, showVersionLabel: _sv, ...rest } = item;
  return rest;
}

const VERSION_STYLE_MAP: Record<string, { idleBg: string; idleBorder: string; idleText: string; activeBg: string; activeBorder: string; activeText: string }> = {
  green: { idleBg: '#f6ffed', idleBorder: '#b7eb8f', idleText: '#389e0d', activeBg: '#389e0d', activeBorder: '#237804', activeText: '#ffffff' },
  orange: { idleBg: '#fff7e6', idleBorder: '#ffd591', idleText: '#d46b08', activeBg: '#d46b08', activeBorder: '#ad4e00', activeText: '#ffffff' },
  purple: { idleBg: '#f9f0ff', idleBorder: '#d3adf7', idleText: '#722ed1', activeBg: '#722ed1', activeBorder: '#531dab', activeText: '#ffffff' },
  cyan: { idleBg: '#e6fffb', idleBorder: '#87e8de', idleText: '#08979c', activeBg: '#08979c', activeBorder: '#006d75', activeText: '#ffffff' },
  magenta: { idleBg: '#fff0f6', idleBorder: '#ffadd2', idleText: '#c41d7f', activeBg: '#c41d7f', activeBorder: '#9e1068', activeText: '#ffffff' },
  gold: { idleBg: '#fffbe6', idleBorder: '#ffe58f', idleText: '#d48806', activeBg: '#d48806', activeBorder: '#ad6800', activeText: '#ffffff' },
  lime: { idleBg: '#fcffe6', idleBorder: '#eaff8f', idleText: '#7cb305', activeBg: '#7cb305', activeBorder: '#5b8c00', activeText: '#ffffff' },
};

export function getVersionButtonStyle(versionIndex: number, active: boolean): CSSProperties {
  const token = getVersionTagColor(versionIndex);
  const palette = VERSION_STYLE_MAP[token] || VERSION_STYLE_MAP.green;
  if (active) {
    return {
      backgroundColor: palette.activeBg,
      borderColor: palette.activeBorder,
      color: palette.activeText,
      fontWeight: 600,
    };
  }
  return {
    backgroundColor: palette.idleBg,
    borderColor: palette.idleBorder,
    color: palette.idleText,
    fontWeight: 400,
  };
}
