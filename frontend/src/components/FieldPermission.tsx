/** 权限配置 - 目前所有角色全权限，后续只需修改此配置 */
export interface FieldPermissionConfig {
  visible: boolean;
  editable: boolean;
}

type RolePermissions = Record<string, Record<string, FieldPermissionConfig>>;

const DEFAULT_PERMISSION: FieldPermissionConfig = {
  visible: true,
  editable: true,
};

/** 当前默认角色 */
const CURRENT_ROLE = 'admin';

/** 权限配置表 - 按角色和 field_code 配置 */
const PERMISSIONS: RolePermissions = {
  admin: {},
  sales: {},
  viewer: {},
};

interface FieldPermissionProps {
  fieldCode: string;
  children: React.ReactNode;
  mode?: 'view' | 'edit';
  fallback?: React.ReactNode;
}

/**
 * 字段权限控制组件
 * 传入 field_code，根据角色权限配置控制显示/编辑
 */
export function FieldPermission({
  fieldCode,
  children,
  mode = 'edit',
  fallback = null,
}: FieldPermissionProps) {
  const rolePerms = PERMISSIONS[CURRENT_ROLE] || {};
  const perm = rolePerms[fieldCode] || DEFAULT_PERMISSION;

  if (!perm.visible) {
    return <>{fallback}</>;
  }

  if (mode === 'edit' && !perm.editable) {
    return <>{fallback ?? children}</>;
  }

  return <>{children}</>;
}

export function isFieldEditable(fieldCode: string): boolean {
  const rolePerms = PERMISSIONS[CURRENT_ROLE] || {};
  return (rolePerms[fieldCode] || DEFAULT_PERMISSION).editable;
}

export function isFieldVisible(fieldCode: string): boolean {
  const rolePerms = PERMISSIONS[CURRENT_ROLE] || {};
  return (rolePerms[fieldCode] || DEFAULT_PERMISSION).visible;
}
