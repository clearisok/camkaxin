import { useCallback, useState } from 'react';
import type { TablePaginationConfig } from 'antd';

export const DEFAULT_TABLE_PAGE_SIZE = 100;
export const TABLE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export function loadTablePageSize(storageKey: string, fallback = DEFAULT_TABLE_PAGE_SIZE): number {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const size = Number(raw);
    return TABLE_PAGE_SIZE_OPTIONS.includes(size) ? size : fallback;
  } catch {
    return fallback;
  }
}

export function saveTablePageSize(storageKey: string, size: number) {
  if (!TABLE_PAGE_SIZE_OPTIONS.includes(size)) return;
  localStorage.setItem(storageKey, String(size));
}

export function useTablePagination(storageKey: string, initialPage = 1) {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(() => loadTablePageSize(storageKey));

  const applyPagination = useCallback((pagination?: TablePaginationConfig) => {
    if (!pagination) return;
    if (pagination.pageSize && pagination.pageSize !== pageSize) {
      setPageSize(pagination.pageSize);
      saveTablePageSize(storageKey, pagination.pageSize);
      setPage(pagination.current || 1);
      return;
    }
    if (pagination.current) setPage(pagination.current);
  }, [pageSize, storageKey]);

  const resetPage = useCallback(() => setPage(1), []);

  const paginationConfig: TablePaginationConfig = {
    current: page,
    pageSize,
    showSizeChanger: true,
    pageSizeOptions: TABLE_PAGE_SIZE_OPTIONS.map(String),
  };

  return { page, pageSize, setPage, applyPagination, resetPage, paginationConfig };
}
