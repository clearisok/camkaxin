import { Navigate } from 'react-router-dom';
import { usePermission } from '@/hooks/usePermission';

interface RequirePermissionProps {
  permission: string | string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function RequirePermission({ permission, children, fallback }: RequirePermissionProps) {
  const { hasPermission, hasAnyPermission } = usePermission();
  const codes = Array.isArray(permission) ? permission : [permission];
  const allowed = codes.length === 1 ? hasPermission(codes[0]) : hasAnyPermission(codes);

  if (!allowed) {
    if (fallback) return <>{fallback}</>;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
