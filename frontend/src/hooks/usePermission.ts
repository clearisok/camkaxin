import { useAuth } from '@/contexts/AuthContext';

export function usePermission() {
  const { user, hasPermission, hasAnyPermission, isFieldVisible, isFieldEditable, fieldPermissions } = useAuth();

  return {
    hasPermission,
    hasAnyPermission,
    permissions: user?.permissions ?? [],
    isFieldVisible,
    isFieldEditable,
    fieldPermissions,
  };
}
