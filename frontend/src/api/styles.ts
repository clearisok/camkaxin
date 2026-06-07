import api from '@/api';
import type { StyleRecord, StyleHistoryRecord, MonthlySummaryItem } from '@/types/style';

export const getStyles = (params: Record<string, unknown> = {}) =>
  api.get<{ data: StyleRecord[] }>('/styles', { params }).then((r) => r.data);

export const updateStyle = (id: number, data: Record<string, unknown>) =>
  api.put<{ data: StyleRecord }>(`/styles/${id}`, data).then((r) => r.data);

export const bulkUpdateStyles = (updates: Array<{ id: number } & Record<string, unknown>>) =>
  api.put<{ data: StyleRecord[] }>('/styles/bulk', { updates }).then((r) => r.data);

export const getStyleHistory = (id: number) =>
  api.get<{ data: StyleHistoryRecord[] }>(`/styles/${id}/history`).then((r) => r.data);

export const getMonthlySummary = () =>
  api.get<{ data: MonthlySummaryItem[] }>('/styles/monthly-summary').then((r) => r.data);
