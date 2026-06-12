import dayjs from 'dayjs';

/** 默认关账月份：当前年月 YYYY-MM */
export function defaultClosingMonth(): string {
  return dayjs().format('YYYY-MM');
}

export type EarlyWarningSearchScope = 'local' | 'global';

export const EARLY_WARNING_SEARCH_SCOPE_STORAGE_KEY = 'scheduling-early-warning-search-scope';

export function loadEarlyWarningSearchScope(): EarlyWarningSearchScope {
  try {
    const raw = localStorage.getItem(EARLY_WARNING_SEARCH_SCOPE_STORAGE_KEY);
    return raw === 'global' ? 'global' : 'local';
  } catch {
    return 'local';
  }
}

export function saveEarlyWarningSearchScope(scope: EarlyWarningSearchScope) {
  localStorage.setItem(EARLY_WARNING_SEARCH_SCOPE_STORAGE_KEY, scope);
}