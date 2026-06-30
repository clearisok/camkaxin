import api from '@/api/index';

export interface PermissionItem {
  id: number;
  code: string;
  name: string;
  module: string;
  sort_order: number;
}

export interface AdminRole {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permissions: string[];
}

export interface AdminUser {
  id: number;
  username: string;
  display_name: string | null;
  email: string | null;
  status: string;
  is_super_admin: boolean;
  last_login_at: string | null;
  created_at: string;
  roles: string[];
}

export const getAdminPermissions = () =>
  api.get<{ data: PermissionItem[] }>('/admin/permissions').then((r) => r.data.data);

export const getAdminRoles = () =>
  api.get<{ data: AdminRole[] }>('/admin/roles').then((r) => r.data.data);

export const updateRolePermissions = (roleId: number, codes: string[]) =>
  api.put<{ data: AdminRole }>(`/admin/roles/${roleId}/permissions`, { codes }).then((r) => r.data.data);

export const getAdminUsers = () =>
  api.get<{ data: AdminUser[] }>('/admin/users').then((r) => r.data.data);

export const createAdminUser = (data: {
  username: string;
  password: string;
  displayName?: string;
  email?: string;
  roleCodes: string[];
  isSuperAdmin?: boolean;
}) => api.post<{ data: AdminUser }>('/admin/users', data).then((r) => r.data.data);

export const updateAdminUser = (
  id: number,
  data: {
    displayName?: string;
    email?: string;
    status?: string;
    roleCodes?: string[];
    isSuperAdmin?: boolean;
  },
) => api.put<{ data: AdminUser }>(`/admin/users/${id}`, data).then((r) => r.data.data);

export const resetAdminUserPassword = (id: number, password: string) =>
  api.put(`/admin/users/${id}/password`, { password }).then((r) => r.data);

export const deleteAdminUser = (id: number) =>
  api.delete(`/admin/users/${id}`).then((r) => r.data);

export interface FieldMetaItem {
  field_code: string;
  label: string;
  type: string;
  module?: string;
}

export interface RoleFieldPermissionItem {
  field_code: string;
  label: string;
  module: string;
  type: string;
  visible: boolean;
  editable: boolean;
  configured: boolean;
}

export const getAdminFieldMeta = () =>
  api.get<{ data: FieldMetaItem[] }>('/admin/field-meta').then((r) => r.data.data);

export const getRoleFieldPermissions = (roleId: number) =>
  api.get<{ data: RoleFieldPermissionItem[] }>(`/admin/roles/${roleId}/field-permissions`).then((r) => r.data.data);

export const updateRoleFieldPermissions = (
  roleId: number,
  items: Array<{ fieldCode: string; visible: boolean; editable: boolean }>,
) =>
  api.put<{ data: RoleFieldPermissionItem[] }>(`/admin/roles/${roleId}/field-permissions`, { items }).then((r) => r.data.data);
