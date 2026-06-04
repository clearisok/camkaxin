import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.error || err.message || '请求失败';
    return Promise.reject(new Error(message));
  }
);

export default api;

// Agents
export const getAgents = () => api.get('/agents').then((r) => r.data);
export const createAgent = (data: { name: string; status?: string }) =>
  api.post('/agents', data).then((r) => r.data);
export const updateAgent = (id: number, data: { name?: string; status?: string }) =>
  api.put(`/agents/${id}`, data).then((r) => r.data);
export const deleteAgent = (id: number) => api.delete(`/agents/${id}`).then((r) => r.data);

// Brands
export const getBrands = () => api.get('/brands').then((r) => r.data);
export const createBrand = (data: { name: string; agent_id?: number; status?: string }) =>
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
export const exportExcel = (quotationId: number, templateId?: number, splitByItem = false) =>
  api.post('/settings/export-excel', { quotation_id: quotationId, template_id: templateId, split_by_item: splitByItem }, { responseType: 'blob' });

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
