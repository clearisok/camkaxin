import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const e = err as Error & { code?: string; response?: { status?: number; data?: { error?: string } }; config?: { url?: string } };
    // #region agent log
    fetch('http://127.0.0.1:7866/ingest/949bb3a4-1e98-433b-8c2f-5ab46646876f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6f51ef'},body:JSON.stringify({sessionId:'6f51ef',location:'api/index.ts:interceptor',message:'API request failed',data:{message:e.message,name:e.name,code:(err as {code?:string}).code,status:err.response?.status,responseError:err.response?.data?.error,responseData:err.response?.data,url:err.config?.url,method:err.config?.method},timestamp:Date.now(),hypothesisId:'H-D',runId:'pre-fix'})}).catch(()=>{});
    // #endregion
    if (!err.response && (e.code === 'ERR_NETWORK' || e.message === 'Network Error')) {
      return Promise.reject(new Error('无法连接后端服务，请确认已运行 npm run dev'));
    }
    const raw = err.response?.data?.error
      || (err.response?.status === 500 && !err.response?.data?.error
        ? '后端服务异常（可能已崩溃），请确认 PostgreSQL 已启动并重启 npm run dev'
        : undefined)
      || err.message
      || '请求失败';
    const message = typeof raw === 'string' ? raw.replace(/^Error:\s*/i, '') : String(raw);
    return Promise.reject(new Error(message));
  }
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
