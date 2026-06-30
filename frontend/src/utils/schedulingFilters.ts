import { todayYm } from '@/utils/beijingTime';

/** 默认关账月份：北京当前年月 YYYY-MM */
export function defaultClosingMonth(): string {
  return todayYm();
}

export type EarlyWarningSearchScope = 'local' | 'global' | 'accumulate';

export const EARLY_WARNING_SEARCH_SCOPE_STORAGE_KEY = 'scheduling-early-warning-search-scope';

export function loadEarlyWarningSearchScope(): EarlyWarningSearchScope {
  try {
    const raw = localStorage.getItem(EARLY_WARNING_SEARCH_SCOPE_STORAGE_KEY);
    if (raw === 'global') return 'global';
    if (raw === 'accumulate') return 'accumulate';
    return 'local';
  } catch {
    return 'local';
  }
}

export function saveEarlyWarningSearchScope(scope: EarlyWarningSearchScope) {
  localStorage.setItem(EARLY_WARNING_SEARCH_SCOPE_STORAGE_KEY, scope);
}