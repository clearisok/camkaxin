import api from '@/api';
import type { StyleRecord, StyleHistoryRecord, MonthlySummaryItem } from '@/types/style';

export const getStyles = (params: Record<string, unknown> = {}) =>
  api.get<{ data: StyleRecord[] }>('/styles', { params }).then((r) => r.data);

export const fillEarlyWarningGaps = () =>
  api.post<{ data: { updated: number; fieldsFilled: number } }>('/styles/fill-gaps').then((r) => r.data);

export const getStyle = (id: number) =>
  api.get<{ data: StyleRecord }>(`/styles/${id}`).then((r) => r.data);

export const createStyle = (data: Record<string, unknown>) =>
  api.post<{ data: StyleRecord }>('/styles', data).then((r) => r.data);

export const updateStyle = (id: number, data: Record<string, unknown>) =>
  api.put<{ data: StyleRecord }>(`/styles/${id}`, data).then((r) => r.data);

export interface ScheduleStylePayload {
  schedule_qty: number;
  required_days: number;
  is_outsourced: boolean;
  group_name?: string | null;
  outsourced_factory?: string | null;
  outsourced_price?: number | null;
  scheduling_remarks?: string | null;
}

export const scheduleStyle = (id: number, data: ScheduleStylePayload) =>
  api.post<{ data: StyleRecord }>(`/styles/${id}/schedule`, data).then((r) => r.data);

export const bulkUpdateStyles = (updates: Array<{ id: number } & Record<string, unknown>>) =>
  api.put<{ data: StyleRecord[] }>('/styles/bulk', { updates }).then((r) => r.data);

export const getStyleHistory = (id: number) =>
  api.get<{ data: StyleHistoryRecord[] }>(`/styles/${id}/history`).then((r) => r.data);

export const getMonthlySummary = () =>
  api.get<{ data: MonthlySummaryItem[] }>('/styles/monthly-summary').then((r) => r.data);
