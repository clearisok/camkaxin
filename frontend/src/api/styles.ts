import api from '@/api';
import type { EarlyWarningExportTemplate } from '@/types/earlyWarningExportTemplate';
import type { StyleRecord, StyleHistoryRecord, MonthlySummaryItem, ClosingMonthLock } from '@/types/style';

export const getStyles = (params: Record<string, unknown> = {}) =>
  api.get<{ data: StyleRecord[] }>('/styles', { params }).then((r) => r.data);

export const getStyleFieldOptions = (params: {
  field: string;
  view?: string;
  closing_month?: string;
  unscheduled_only?: boolean;
  q?: string;
}) => api.get<{ data: string[] }>('/styles/field-options', { params }).then((r) => r.data);

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
  online_time?: string | null;
  offline_time?: string | null;
}

export const scheduleStyle = (id: number, data: ScheduleStylePayload) =>
  api.post<{ data: StyleRecord }>(`/styles/${id}/schedule`, data).then((r) => r.data);

export const moveStyle = (id: number, target: string) =>
  api.post<{ data: StyleRecord }>(`/styles/${id}/move`, { target }).then((r) => r.data);

export const reorderStyle = (id: number, direction: 'up' | 'down') =>
  api.post<{ data: StyleRecord }>(`/styles/${id}/reorder`, { direction }).then((r) => r.data);

export const offlineStyle = (id: number) =>
  api.post<{ data: StyleRecord }>(`/styles/${id}/offline`, {}).then((r) => r.data);

export const extendStyleDays = (id: number, extraWorkdays: number) =>
  api.post<{ data: StyleRecord }>(`/styles/${id}/extend-days`, { extra_workdays: extraWorkdays }).then((r) => r.data);

export interface OutsourceStylePayload {
  outsourced_factory: string;
  outsourced_price?: number | null;
  online_time?: string | null;
  offline_time?: string | null;
  required_days?: number | null;
}

export const outsourceStyle = (id: number, data: OutsourceStylePayload) =>
  api.post<{ data: StyleRecord }>(`/styles/${id}/outsource`, data).then((r) => r.data);

export const previewOutsourceDates = (data: {
  online_time?: string | null;
  offline_time?: string | null;
  required_days?: number | null;
}) =>
  api.post<{ data: { online_time: string; offline_time: string; required_days: number } }>(
    '/styles/scheduling/preview-outsource-dates',
    data,
  ).then((r) => r.data);

export const getOfflineNotifications = () =>
  api.get<{ data: StyleRecord[] }>('/styles/offline-notifications').then((r) => r.data);

export const batchConfirmOffline = (ids: number[]) =>
  api.post<{ data: StyleRecord[] }>('/styles/scheduling/batch-offline', { ids }).then((r) => r.data);

export const batchExtendWorkdays = (items: Array<{ id: number; extra_workdays: number }>) =>
  api.post<{ data: StyleRecord[] }>('/styles/scheduling/batch-extend', { items }).then((r) => r.data);

export const bulkUpdateStyles = (updates: Array<{ id: number } & Record<string, unknown>>) =>
  api.put<{ data: StyleRecord[] }>('/styles/bulk', { updates }).then((r) => r.data);

export const getStyleHistory = (id: number) =>
  api.get<{ data: StyleHistoryRecord[] }>(`/styles/${id}/history`).then((r) => r.data);

export const getEarlyWarningExportTemplates = () =>
  api.get<{ data: EarlyWarningExportTemplate[] }>('/styles/export-templates', { params: { view: 'early_warning' } }).then((r) => r.data);

export const getSchedulingExportTemplates = () =>
  api.get<{ data: EarlyWarningExportTemplate[] }>('/styles/export-templates', { params: { view: 'scheduling' } }).then((r) => r.data);

export const exportSchedulingExcel = (payload: {
  style_ids: number[];
  column_keys: string[];
  meta: Record<string, unknown>;
  template_id?: number | null;
}) => api.post('/styles/export/scheduling', payload, { responseType: 'blob' });

export const exportEarlyWarningExcel = (payload: {
  style_ids: number[];
  column_keys: string[];
  meta: Record<string, unknown>;
  template_id?: number | null;
}) => api.post('/styles/export/early-warning', payload, { responseType: 'blob' });

export const getMonthlySummary = () =>
  api.get<{ data: MonthlySummaryItem[] }>('/styles/monthly-summary').then((r) => r.data);

export const getClosingLocks = () =>
  api.get<{ data: ClosingMonthLock[] }>('/styles/closing-locks').then((r) => r.data);

export const lockClosingMonth = (closing_month: string) =>
  api.post<{ data: ClosingMonthLock }>('/styles/closing-locks', { closing_month }).then((r) => r.data);

export const unlockClosingMonth = (closing_month: string) =>
  api.delete(`/styles/closing-locks/${encodeURIComponent(closing_month)}`).then((r) => r.data);

export const cancelStyleOrder = (
  id: number,
  data: { cancel_qty?: number; cancel_all?: boolean; reason?: string },
) => api.post<{ data: StyleRecord }>(`/styles/${id}/cancel`, data).then((r) => r.data);

export type SandboxOperation =
  | { type: 'move'; id: number; target: string; label: string }
  | { type: 'offline'; id: number; label: string }
  | { type: 'reorder'; id: number; direction: 'up' | 'down'; label: string }
  | { type: 'outsource'; id: number; payload: OutsourceStylePayload; label: string }
  | { type: 'extend'; id: number; extra_workdays: number; label: string };

export const previewSandboxScheduling = (ops: SandboxOperation[]) =>
  api.post<{ data: StyleRecord[] }>('/styles/scheduling/sandbox-preview', { ops }).then((r) => r.data);

export async function applySandboxOperations(ops: SandboxOperation[]) {
  for (const op of ops) {
    switch (op.type) {
      case 'move':
        await moveStyle(op.id, op.target);
        break;
      case 'offline':
        await offlineStyle(op.id);
        break;
      case 'reorder':
        await reorderStyle(op.id, op.direction);
        break;
      case 'outsource':
        await outsourceStyle(op.id, op.payload);
        break;
      case 'extend':
        await extendStyleDays(op.id, op.extra_workdays);
        break;
      default:
        break;
    }
  }
}
