import api from '@/api/index';
import { getStoredToken, setStoredToken } from '@/api/tokenStorage';

export interface FieldPermissionConfig {
  visible: boolean;
  editable: boolean;
}

export interface AuthUser {
  id: number;
  username: string;
  displayName: string | null;
  isSuperAdmin: boolean;
  roles: string[];
  permissions: string[];
  fieldPermissions: Record<string, FieldPermissionConfig>;
}

export { getStoredToken, setStoredToken };

export async function loginRequest(username: string, password: string) {
  const res = await api.post<{ data: { user: AuthUser; token: string } }>('/auth/login', {
    username,
    password,
  });
  return res.data.data;
}

export async function logoutRequest() {
  try {
    await api.post('/auth/logout');
  } finally {
    setStoredToken(null);
  }
}

export async function fetchCurrentUser() {
  const res = await api.get<{ data: { user: AuthUser } }>('/auth/me');
  return res.data.data.user;
}
