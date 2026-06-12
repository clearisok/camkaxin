import type { StyleRecord } from '@/types/style';
import { defaultClosingMonth, type EarlyWarningSearchScope } from '@/utils/schedulingFilters';

export const EARLY_WARNING_FILTERS_STORAGE_KEY = 'scheduling-early-warning-filters';
export const EARLY_WARNING_LIST_CACHE_KEY = 'scheduling-early-warning-list-cache';
export const EARLY_WARNING_GAPS_FILLED_KEY = 'scheduling-early-warning-gaps-filled';

export interface EarlyWarningFilterState {
  searchInput: string;
  searchScope: EarlyWarningSearchScope;
  brandFilters: string[];
  salespersonFilters: string[];
  closingMonthFilters: string[];
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
    brandFilters: [],
    salespersonFilters: [],
    closingMonthFilters: [defaultClosingMonth()],
    unscheduledOnly: false,
  };
}

export function loadEarlyWarningFilters(): EarlyWarningFilterState {
  try {
    const raw = sessionStorage.getItem(EARLY_WARNING_FILTERS_STORAGE_KEY);
    if (!raw) return defaultFilters();
    const parsed = JSON.parse(raw) as Partial<EarlyWarningFilterState>;
    return {
      ...defaultFilters(),
      ...parsed,
      closingMonthFilters: Array.isArray(parsed.closingMonthFilters) && parsed.closingMonthFilters.length
        ? parsed.closingMonthFilters
        : [defaultClosingMonth()],
    };
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
    return JSON.parse(raw) as EarlyWarningListCache;
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
