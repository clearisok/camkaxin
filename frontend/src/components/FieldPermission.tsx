/** 字段权限控制 — 读取 AuthContext 中的 fieldPermissions */
import { useAuth } from '@/contexts/AuthContext';

interface FieldPermissionProps {
  fieldCode: string;
  children: React.ReactNode;
  mode?: 'view' | 'edit';
  fallback?: React.ReactNode;
}

export function FieldPermission({
  fieldCode,
  children,
  mode = 'edit',
  fallback = null,
}: FieldPermissionProps) {
  const { user, isFieldVisible, isFieldEditable } = useAuth();

  if (!user) return <>{fallback}</>;

  if (!isFieldVisible(fieldCode)) {
    return <>{fallback}</>;
  }

  if (mode === 'edit' && !isFieldEditable(fieldCode)) {
    return <>{fallback ?? children}</>;
  }

  return <>{children}</>;
}

export function useFieldPermission() {
  const { isFieldVisible, isFieldEditable, fieldPermissions } = useAuth();
  return { isFieldVisible, isFieldEditable, fieldPermissions };
}
