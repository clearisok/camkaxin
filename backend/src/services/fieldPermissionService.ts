import { query } from '../config/database.js';
import {
  DEFAULT_FIELD_PERMISSION,
  DEFAULT_ROLE_FIELD_OVERRIDES,
  canEditField,
  listFieldMetaCatalog,
  userHasFullFieldAccess,
  type FieldPermissionMap,
} from '../constants/fieldPermissions.js';
import { SYSTEM_ROLES } from '../constants/permissions.js';
import {
  ITEM_DB_TO_FIELD,
  QUOTATION_DB_TO_FIELD,
  STYLE_DB_TO_FIELD,
} from '../utils/fieldMeta.js';

export {
  canEditField,
  canViewField,
  resolveFieldPermission,
  userHasFullFieldAccess,
  DEFAULT_FIELD_PERMISSION,
  FULL_FIELD_PERMISSION,
  mergeFieldPermissionMaps,
} from '../constants/fieldPermissions.js';
export type { FieldPermissionConfig, FieldPermissionMap } from '../constants/fieldPermissions.js';

interface RoleFieldRow {
  field_code: string;
  visible: boolean;
  editable: boolean;
}

async function roleHasFieldPermissions(roleId: number): Promise<boolean> {
  const res = await query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM role_field_permissions WHERE role_id = $1',
    [roleId],
  );
  return Number(res.rows[0]?.count ?? 0) > 0;
}

async function assignRoleFieldPermissions(
  roleId: number,
  items: Array<{ fieldCode: string; visible: boolean; editable: boolean }>,
): Promise<void> {
  await query('DELETE FROM role_field_permissions WHERE role_id = $1', [roleId]);
  for (const item of items) {
    await query(
      `INSERT INTO role_field_permissions (role_id, field_code, visible, editable)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (role_id, field_code) DO UPDATE SET
         visible = EXCLUDED.visible,
         editable = EXCLUDED.editable`,
      [roleId, item.fieldCode, item.visible, item.editable],
    );
  }
}

/** 首次启动时为内置角色写入默认字段权限（已有配置不覆盖） */
export async function seedDefaultFieldPermissions(): Promise<void> {
  for (const role of SYSTEM_ROLES) {
    if (role.code === 'admin') continue;

    const roleRes = await query<{ id: number }>('SELECT id FROM roles WHERE code = $1', [role.code]);
    const roleId = roleRes.rows[0]?.id;
    if (!roleId) continue;

    const hasRows = await roleHasFieldPermissions(roleId);
    if (hasRows) continue;

    const overrides = DEFAULT_ROLE_FIELD_OVERRIDES[role.code];
    if (!overrides?.length) continue;

    await assignRoleFieldPermissions(roleId, overrides);
  }
}

/** 加载用户有效字段权限（多角色并集） */
export async function loadUserFieldPermissions(
  userId: number,
  isSuperAdmin: boolean,
  roles: string[],
): Promise<FieldPermissionMap> {
  if (userHasFullFieldAccess({ isSuperAdmin, roles, fieldPermissions: {} })) {
    return {};
  }

  const res = await query<RoleFieldRow>(
    `SELECT rfp.field_code, rfp.visible, rfp.editable
     FROM role_field_permissions rfp
     INNER JOIN user_roles ur ON ur.role_id = rfp.role_id
     WHERE ur.user_id = $1`,
    [userId],
  );

  const map: FieldPermissionMap = {};
  for (const row of res.rows) {
    const existing = map[row.field_code];
    if (!existing) {
      map[row.field_code] = { visible: row.visible, editable: row.editable };
    } else {
      map[row.field_code] = {
        visible: existing.visible || row.visible,
        editable: existing.editable || row.editable,
      };
    }
  }
  return map;
}

export interface AdminFieldPermissionItem {
  field_code: string;
  label: string;
  module: string;
  type: string;
  visible: boolean;
  editable: boolean;
  configured: boolean;
}

export async function getRoleFieldPermissionsForAdmin(
  roleId: number,
  roleCode: string,
): Promise<AdminFieldPermissionItem[]> {
  if (roleCode === 'admin') {
    return listFieldMetaCatalog().map((f) => ({
      field_code: f.field_code,
      label: f.label,
      module: f.module ?? f.field_code.split('.')[0],
      type: f.type,
      visible: true,
      editable: true,
      configured: false,
    }));
  }

  const rows = await query<RoleFieldRow>(
    'SELECT field_code, visible, editable FROM role_field_permissions WHERE role_id = $1',
    [roleId],
  );
  const rowMap = new Map(rows.rows.map((r) => [r.field_code, r]));

  return listFieldMetaCatalog().map((f) => {
    const row = rowMap.get(f.field_code);
    return {
      field_code: f.field_code,
      label: f.label,
      module: f.module ?? f.field_code.split('.')[0],
      type: f.type,
      visible: row?.visible ?? DEFAULT_FIELD_PERMISSION.visible,
      editable: row?.editable ?? DEFAULT_FIELD_PERMISSION.editable,
      configured: !!row,
    };
  });
}

export async function updateRoleFieldPermissions(
  roleId: number,
  roleCode: string,
  items: Array<{ fieldCode: string; visible: boolean; editable: boolean }>,
): Promise<AdminFieldPermissionItem[]> {
  if (roleCode === 'admin') {
    throw new Error('系统管理员角色拥有全部字段权限，不可修改');
  }

  const normalized = items.map((item) => ({
    fieldCode: item.fieldCode,
    visible: item.visible,
    editable: item.visible ? item.editable : false,
  }));

  await assignRoleFieldPermissions(roleId, normalized);
  return getRoleFieldPermissionsForAdmin(roleId, roleCode);
}

export function assertFieldsEditable(
  user: {
    isSuperAdmin: boolean;
    roles: string[];
    fieldPermissions: FieldPermissionMap;
  },
  fieldCodes: string[],
): void {
  for (const code of fieldCodes) {
    if (!canEditField(user, code)) {
      throw new Error(`无权限编辑字段: ${code}`);
    }
  }
}

export function collectQuotationFieldCodes(data: Record<string, unknown>): string[] {
  const codes: string[] = [];

  for (const key of Object.keys(data)) {
    if (key === 'items') continue;
    const code = QUOTATION_DB_TO_FIELD[key];
    if (code) codes.push(code);
  }

  const items = data.items;
  if (Array.isArray(items)) {
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      for (const key of Object.keys(item as Record<string, unknown>)) {
        const code = ITEM_DB_TO_FIELD[key];
        if (code) codes.push(code);
      }
    }
  }

  return [...new Set(codes)];
}

export function collectStyleFieldCodes(data: Record<string, unknown>): string[] {
  const codes: string[] = [];
  for (const key of Object.keys(data)) {
    const code = STYLE_DB_TO_FIELD[key];
    if (code) codes.push(code);
  }
  return [...new Set(codes)];
}
