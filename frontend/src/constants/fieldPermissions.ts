export interface FieldPermissionConfig {
  visible: boolean;
  editable: boolean;
}

export const DEFAULT_FIELD_PERMISSION: FieldPermissionConfig = {
  visible: true,
  editable: false,
};

export const FULL_FIELD_PERMISSION: FieldPermissionConfig = {
  visible: true,
  editable: true,
};

export const FIELD_MODULE_LABELS: Record<string, string> = {
  agent: '业务员',
  brand: '品牌',
  fabric: '面料',
  accessory: '辅料',
  quotation: '报价单',
  item: '报价明细',
  style: '款式/排单',
};

export function resolveFieldPermission(
  fieldPermissions: Record<string, FieldPermissionConfig>,
  fieldCode: string,
  user?: { isSuperAdmin: boolean; roles: string[] },
): FieldPermissionConfig {
  if (user && (user.isSuperAdmin || user.roles.includes('admin'))) {
    return FULL_FIELD_PERMISSION;
  }
  return fieldPermissions[fieldCode] ?? DEFAULT_FIELD_PERMISSION;
}
