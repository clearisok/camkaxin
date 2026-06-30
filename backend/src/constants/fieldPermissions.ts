import {
  ALL_FIELD_META,
  ITEM_FIELDS,
  QUOTATION_FIELDS,
  STYLE_FIELDS,
  type FieldMeta,
} from '../utils/fieldMeta.js';

export interface FieldPermissionConfig {
  visible: boolean;
  editable: boolean;
}

export type FieldPermissionMap = Record<string, FieldPermissionConfig>;

export const DEFAULT_FIELD_PERMISSION: FieldPermissionConfig = {
  visible: true,
  editable: false,
};

export const FULL_FIELD_PERMISSION: FieldPermissionConfig = {
  visible: true,
  editable: true,
};

/** 角色字段权限种子：仅写入与默认不同的项 */
export const DEFAULT_ROLE_FIELD_OVERRIDES: Record<
  string,
  Array<{ fieldCode: string; visible: boolean; editable: boolean }>
> = {
  sales: [
    { fieldCode: 'quotation.profit_margin', visible: true, editable: false },
    { fieldCode: 'quotation.confirmed_labor_price', visible: false, editable: false },
    { fieldCode: 'quotation.confirmed_garment_price', visible: false, editable: false },
  ],
  quotation_manager: [
    ...QUOTATION_FIELDS.map((f) => ({ fieldCode: f.field_code, visible: true, editable: true })),
    ...ITEM_FIELDS.map((f) => ({ fieldCode: f.field_code, visible: true, editable: true })),
  ],
  scheduler: [
    ...QUOTATION_FIELDS.map((f) => ({ fieldCode: f.field_code, visible: true, editable: false })),
    ...ITEM_FIELDS.map((f) => ({ fieldCode: f.field_code, visible: true, editable: false })),
    ...STYLE_FIELDS.map((f) => ({ fieldCode: f.field_code, visible: true, editable: true })),
  ],
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

export function listFieldMetaCatalog(): FieldMeta[] {
  return ALL_FIELD_META;
}

export function userHasFullFieldAccess(user: {
  isSuperAdmin: boolean;
  roles: string[];
}): boolean {
  return user.isSuperAdmin || user.roles.includes('admin');
}

export function resolveFieldPermission(
  fieldPermissions: FieldPermissionMap,
  fieldCode: string,
  user?: { isSuperAdmin: boolean; roles: string[] },
): FieldPermissionConfig {
  if (user && userHasFullFieldAccess(user)) {
    return FULL_FIELD_PERMISSION;
  }
  return fieldPermissions[fieldCode] ?? DEFAULT_FIELD_PERMISSION;
}

export function canViewField(
  user: { isSuperAdmin: boolean; roles: string[]; fieldPermissions: FieldPermissionMap },
  fieldCode: string,
): boolean {
  return resolveFieldPermission(user.fieldPermissions, fieldCode, user).visible;
}

export function canEditField(
  user: { isSuperAdmin: boolean; roles: string[]; fieldPermissions: FieldPermissionMap },
  fieldCode: string,
): boolean {
  if (userHasFullFieldAccess(user)) return true;
  const perm = resolveFieldPermission(user.fieldPermissions, fieldCode, user);
  return perm.visible && perm.editable;
}

export function mergeFieldPermissionMaps(maps: FieldPermissionMap[]): FieldPermissionMap {
  const merged: FieldPermissionMap = {};
  for (const map of maps) {
    for (const [code, perm] of Object.entries(map)) {
      const existing = merged[code];
      if (!existing) {
        merged[code] = { ...perm };
        continue;
      }
      merged[code] = {
        visible: existing.visible || perm.visible,
        editable: existing.editable || perm.editable,
      };
    }
  }
  return merged;
}
