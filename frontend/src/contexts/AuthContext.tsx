import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  fetchCurrentUser,
  loginRequest,
  logoutRequest,
  type AuthUser,
} from '@/api/auth';
import { getStoredToken, setStoredToken } from '@/api/tokenStorage';
import {
  resolveFieldPermission,
  type FieldPermissionConfig,
} from '@/constants/fieldPermissions';

function userHasPermission(user: AuthUser | null, code: string): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return user.permissions?.includes(code) ?? false;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
  fieldPermissions: Record<string, FieldPermissionConfig>;
  isFieldVisible: (fieldCode: string) => boolean;
  isFieldEditable: (fieldCode: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      return;
    }
    const me = await fetchCurrentUser();
    setUser(me);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (getStoredToken()) {
          await refreshUser();
        }
      } catch {
        setStoredToken(null);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  const login = useCallback(async (username: string, password: string) => {
    const { user: loggedIn, token } = await loginRequest(username, password);
    setStoredToken(token);
    setUser(loggedIn);
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (code: string) => userHasPermission(user, code),
    [user],
  );

  const hasAnyPermission = useCallback(
    (codes: string[]) => {
      if (!user) return false;
      if (user.isSuperAdmin) return true;
      return codes.some((c) => user.permissions?.includes(c));
    },
    [user],
  );

  const fieldPermissions = user?.fieldPermissions ?? {};

  const isFieldVisible = useCallback(
    (fieldCode: string) => {
      if (!user) return false;
      return resolveFieldPermission(fieldPermissions, fieldCode, user).visible;
    },
    [user, fieldPermissions],
  );

  const isFieldEditable = useCallback(
    (fieldCode: string) => {
      if (!user) return false;
      const perm = resolveFieldPermission(fieldPermissions, fieldCode, user);
      return perm.visible && perm.editable;
    },
    [user, fieldPermissions],
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      login,
      logout,
      refreshUser,
      hasPermission,
      hasAnyPermission,
      fieldPermissions,
      isFieldVisible,
      isFieldEditable,
    }),
    [user, loading, login, logout, refreshUser, hasPermission, hasAnyPermission, fieldPermissions, isFieldVisible, isFieldEditable],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
