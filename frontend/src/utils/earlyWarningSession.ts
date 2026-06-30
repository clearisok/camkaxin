import type { StyleRecord } from '@/types/style';
import type { EarlyWarningSearchScope } from '@/utils/schedulingFilters';
import type { FieldFilterState } from '@/utils/earlyWarningFieldFilter';
import { normalizeFieldFilter } from '@/utils/earlyWarningFieldFilter';
import {
  defaultClosingMonthRange,
  normalizeClosingMonthRange,
  type ClosingMonthRange,
} from '@/utils/closingMonthRange';

export const EARLY_WARNING_FILTERS_STORAGE_KEY = 'scheduling-early-warning-filters';
export const EARLY_WARNING_LIST_CACHE_KEY = 'scheduling-early-warning-list-cache';
export const EARLY_WARNING_GAPS_FILLED_KEY = 'scheduling-early-warning-gaps-filled';

export interface EarlyWarningFilterState {
  searchInput: string;
  searchScope: EarlyWarningSearchScope;
  fieldFilter: FieldFilterState | null;
  closingMonthRange: ClosingMonthRange;
  unscheduledOnly: boolean;
}

export interface EarlyWarningListCache extends EarlyWarningFilterState {
  data: StyleRecord[];
  selectedRowKeys: number[];
  page: number;
}

function defaultFilters(): EarlyWarningFilterState {
  return {
    searchInput: '',
    searchScope: 'local',
    fieldFilter: null,
    closingMonthRange: defaultClosingMonthRange(),
    unscheduledOnly: false,
  };
}

function migrateLegacyFilters(parsed: Record<string, unknown>): EarlyWarningFilterState {
  const base = { ...defaultFilters(), ...parsed } as EarlyWarningFilterState & {
    brandFilters?: string[];
    salespersonFilters?: string[];
    closingMonthFilters?: string[];
    closingMonthStart?: string;
    closingMonthEnd?: string;
  };
  if (!base.fieldFilter) {
    if (base.brandFilters?.length) {
      base.fieldFilter = { field: 'brand', values: base.brandFilters };
    } else if (base.salespersonFilters?.length) {
      base.fieldFilter = { field: 'salesperson', values: base.salespersonFilters };
    }
  }
  base.fieldFilter = normalizeFieldFilter(base.fieldFilter);

  let closingMonthRange = base.closingMonthRange;
  if (!closingMonthRange?.startMonth || !closingMonthRange?.endMonth) {
    if (base.closingMonthStart && base.closingMonthEnd) {
      closingMonthRange = normalizeClosingMonthRange(base.closingMonthStart, base.closingMonthEnd);
    } else if (Array.isArray(base.closingMonthFilters) && base.closingMonthFilters.length > 0) {
      const sorted = [...base.closingMonthFilters].sort();
      closingMonthRange = normalizeClosingMonthRange(sorted[0], sorted[sorted.length - 1]);
    } else {
      closingMonthRange = defaultClosingMonthRange();
    }
  }

  return {
    searchInput: base.searchInput ?? '',
    searchScope: base.searchScope === 'global'
      ? 'global'
      : base.searchScope === 'accumulate'
        ? 'accumulate'
        : 'local',
    fieldFilter: base.fieldFilter,
    closingMonthRange: normalizeClosingMonthRange(closingMonthRange.startMonth, closingMonthRange.endMonth),
    unscheduledOnly: Boolean(base.unscheduledOnly),
  };
}

export function loadEarlyWarningFilters(): EarlyWarningFilterState {
  try {
    const raw = sessionStorage.getItem(EARLY_WARNING_FILTERS_STORAGE_KEY);
    if (!raw) return defaultFilters();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return migrateLegacyFilters(parsed);
  } catch {
    return defaultFilters();
  }
}

export function saveEarlyWarningFilters(state: EarlyWarningFilterState) {
  sessionStorage.setItem(EARLY_WARNING_FILTERS_STORAGE_KEY, JSON.stringify(state));
}

export function saveEarlyWarningListCache(cache: EarlyWarningListCache) {
  sessionStorage.setItem(EARLY_WARNING_LIST_CACHE_KEY, JSON.stringify(cache));
}

export function loadEarlyWarningListCache(): EarlyWarningListCache | null {
  try {
    const raw = sessionStorage.getItem(EARLY_WARNING_LIST_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EarlyWarningListCache & {
      brandFilters?: string[];
      salespersonFilters?: string[];
      closingMonthFilters?: string[];
    };
    const filters = migrateLegacyFilters(parsed as unknown as Record<string, unknown>);
    return {
      searchInput: filters.searchInput,
      searchScope: filters.searchScope,
      fieldFilter: filters.fieldFilter,
      closingMonthRange: filters.closingMonthRange,
      unscheduledOnly: filters.unscheduledOnly,
      data: Array.isArray(parsed.data) ? parsed.data : [],
      selectedRowKeys: Array.isArray(parsed.selectedRowKeys) ? parsed.selectedRowKeys : [],
      page: typeof parsed.page === 'number' ? parsed.page : 1,
    };
  } catch {
    return null;
  }
}

export function clearEarlyWarningListCache() {
  sessionStorage.removeItem(EARLY_WARNING_LIST_CACHE_KEY);
}

export function filtersMatch(a: EarlyWarningFilterState, b: EarlyWarningFilterState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function isEarlyWarningGapsFilled(): boolean {
  return sessionStorage.getItem(EARLY_WARNING_GAPS_FILLED_KEY) === '1';
}

export function markEarlyWarningGapsFilled() {
  sessionStorage.setItem(EARLY_WARNING_GAPS_FILLED_KEY, '1');
}
