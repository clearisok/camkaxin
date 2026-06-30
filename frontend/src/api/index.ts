import axios from 'axios';
import { getStoredToken, setStoredToken } from '@/api/tokenStorage';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const e = err as Error & { code?: string; response?: { status?: number; data?: unknown }; config?: { url?: string; method?: string } };
    const status = e.response?.status;
    const responseData = e.response?.data;
    const url = e.config?.url;

    if (status === 401 && url !== '/auth/login') {
      setStoredToken(null);
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      }
    }

    if (!err.response && (e.code === 'ERR_NETWORK' || e.message === 'Network Error')) {
      return Promise.reject(new Error('无法连接后端服务，请确认已运行 npm run dev'));
    }
    const bodyError = (responseData as { error?: string } | undefined)?.error;
    const raw = bodyError
      || (status === 500 && !bodyError
        ? `后端服务异常（HTTP 500${url ? ` · ${url}` : ''}），请重启 backend 并确认 PostgreSQL 已启动`
        : undefined)
      || e.message
      || '请求失败';
    const message = typeof raw === 'string' ? raw.replace(/^Error:\s*/i, '') : String(raw);
    return Promise.reject(new Error(message));
  },
);

export default api;

// Agents
export const getAgents = () => api.get('/agents').then((r) => r.data);
export const createAgent = (data: { name: string; status?: string; default_wastage?: number; brand_id?: number }) =>
  api.post('/agents', data).then((r) => r.data);
export const updateAgent = (id: number, data: { name?: string; status?: string; default_wastage?: number; brand_id?: number | null }) =>
  api.put(`/agents/${id}`, data).then((r) => r.data);
export const deleteAgent = (id: number) => api.delete(`/agents/${id}`).then((r) => r.data);

// Brands
export const getBrands = () => api.get('/brands').then((r) => r.data);
export const createBrand = (data: { name: string; status?: string }) =>
  api.post('/brands', data).then((r) => r.data);
export const updateBrand = (id: number, data: Record<string, unknown>) =>
  api.put(`/brands/${id}`, data).then((r) => r.data);
export const deleteBrand = (id: number) => api.delete(`/brands/${id}`).then((r) => r.data);
export const getBrandDefaultAccessories = (brandId: number) =>
  api.get(`/brands/${brandId}/default-accessories`).then((r) => r.data);
export const updateBrandDefaultAccessories = (brandId: number, accessories: unknown[]) =>
  api.put(`/brands/${brandId}/default-accessories`, { accessories }).then((r) => r.data);
export const trackBrandUsage = (brandId: number) =>
  api.post(`/brands/${brandId}/track-usage`).then((r) => r.data);

// Fabrics
export const getFabrics = () => api.get('/fabrics').then((r) => r.data);
export const getAllFabrics = () => api.get('/fabrics/all').then((r) => r.data);
export const createFabric = (data: Record<string, unknown>) =>
  api.post('/fabrics', data).then((r) => r.data);
export const updateFabric = (id: number, data: Record<string, unknown>) =>
  api.put(`/fabrics/${id}`, data).then((r) => r.data);
export const deleteFabric = (id: number) => api.delete(`/fabrics/${id}`).then((r) => r.data);

// Accessories
export const getAccessories = () => api.get('/accessories').then((r) => r.data);
export const getAllAccessories = () => api.get('/accessories/all').then((r) => r.data);
export const createAccessory = (data: Record<string, unknown>) =>
  api.post('/accessories', data).then((r) => r.data);
export const updateAccessory = (id: number, data: Record<string, unknown>) =>
  api.put(`/accessories/${id}`, data).then((r) => r.data);
export const deleteAccessory = (id: number) => api.delete(`/accessories/${id}`).then((r) => r.data);

// Calendar exceptions (holiday / workday)
export type CalendarDayType = 'holiday' | 'workday';
export type CalendarExceptionSource = 'manual' | 'cambodia';

export interface CalendarException {
  id: number;
  start_date: string;
  end_date: string;
  day_type: CalendarDayType;
  name: string | null;
  source: CalendarExceptionSource;
  created_at: string;
  updated_at: string;
  day_count?: number;
  period_label?: string;
  weekday_start?: string;
  weekday_end?: string;
  default_workday?: boolean;
  effective_workday?: boolean;
}

export const getCalendarRules = () =>
  api.get('/calendar-exceptions/rules').then((r) => r.data);
export const getCalendarExceptions = (year?: number, effective = false) =>
  api.get('/calendar-exceptions', { params: { year, effective: effective ? '1' : undefined } }).then((r) => r.data);
export const createCalendarException = (data: {
  start_date: string;
  end_date: string;
  day_type: CalendarDayType;
  name?: string;
}) => api.post('/calendar-exceptions', data).then((r) => r.data);
export const updateCalendarException = (id: number, data: {
  start_date?: string;
  end_date?: string;
  day_type?: CalendarDayType;
  name?: string;
}) => api.put(`/calendar-exceptions/${id}`, data).then((r) => r.data);
export const deleteCalendarException = (id: number) =>
  api.delete(`/calendar-exceptions/${id}`).then((r) => r.data);
export const syncCambodiaHolidays = (years?: number[]) =>
  api.post('/calendar-exceptions/sync-cambodia', { years }).then((r) => r.data);

// Settings
export const getSettings = () => api.get('/settings').then((r) => r.data);
export const updateExchangeRate = (value: number) =>
  api.put('/settings/exchange-rate', { value }).then((r) => r.data);
export const getTemplates = () => api.get('/settings/templates').then((r) => r.data);
export const uploadTemplate = (formData: FormData) =>
  api.post('/settings/templates', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
export const deleteTemplate = (id: number) => api.delete(`/settings/templates/${id}`).then((r) => r.data);
export const uploadFile = (file: File, onProgress?: (percent: number) => void) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/settings/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (e.total && onProgress) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
  }).then((r) => r.data);
};
export const exportExcel = (
  quotationId: number,
  templateId?: number,
  splitByItem = false,
  filename?: string
) =>
  api.post('/settings/export-excel', {
    quotation_id: quotationId,
    template_id: templateId,
    split_by_item: splitByItem,
    filename,
  }, { responseType: 'blob' });

export const getExportFilename = (quotationId: number) =>
  api.get(`/settings/export-filename/${quotationId}`).then((r) => r.data);

export const exportSummary = (quotationIds: number[]) =>
  api.post('/settings/export-summary', { quotation_ids: quotationIds }, { responseType: 'blob' });

// Quotations
export const getQuotations = (params?: Record<string, unknown>) =>
  api.get('/quotations', { params }).then((r) => r.data);
export const getQuotation = (id: number) => api.get(`/quotations/${id}`).then((r) => r.data);
export const createQuotation = (data: Record<string, unknown>) =>
  api.post('/quotations', data).then((r) => r.data);
export const updateQuotation = (id: number, data: Record<string, unknown>) =>
  api.put(`/quotations/${id}`, data).then((r) => r.data);
export const copyQuotation = (id: number) => api.post(`/quotations/${id}/copy`).then((r) => r.data);
export const deleteQuotation = (id: number) => api.delete(`/quotations/${id}`).then((r) => r.data);
export const reviseItem = (itemId: number, data: Record<string, unknown>) =>
  api.post(`/quotations/items/${itemId}/revise`, data).then((r) => r.data);
export const getItemSnapshots = (itemId: number) =>
  api.get(`/quotations/items/${itemId}/snapshots`).then((r) => r.data);
