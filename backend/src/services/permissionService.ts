import { query } from '../config/database.js';
import {
  ALL_PERMISSION_CODES,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_DEFS,
  SYSTEM_ROLES,
} from '../constants/permissions.js';

export interface PermissionRow {
  id: number;
  code: string;
  name: string;
  module: string;
  sort_order: number;
}

/** 同步权限字典到数据库 */
export async function syncPermissionCatalog(): Promise<void> {
  for (const def of PERMISSION_DEFS) {
    await query(
      `INSERT INTO permissions (code, name, module, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         module = EXCLUDED.module,
         sort_order = EXCLUDED.sort_order`,
      [def.code, def.name, def.module, def.sortOrder],
    );
  }
}

async function getPermissionIdMap(): Promise<Map<string, number>> {
  const res = await query<{ id: number; code: string }>('SELECT id, code FROM permissions');
  return new Map(res.rows.map((r) => [r.code, r.id]));
}

async function assignRolePermissions(roleId: number, codes: string[]): Promise<void> {
  const idMap = await getPermissionIdMap();
  await query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
  for (const code of codes) {
    const permId = idMap.get(code);
    if (permId) {
      await query(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [roleId, permId],
      );
    }
  }
}

async function roleHasPermissions(roleId: number): Promise<boolean> {
  const res = await query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM role_permissions WHERE role_id = $1',
    [roleId],
  );
  return Number(res.rows[0]?.count ?? 0) > 0;
}

/** 创建默认角色并分配权限 */
export async function seedDefaultRolesAndPermissions(): Promise<void> {
  await syncPermissionCatalog();

  for (const role of SYSTEM_ROLES) {
    const roleRes = await query<{ id: number }>(
      `INSERT INTO roles (code, name, description, is_system)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         is_system = TRUE,
         updated_at = NOW()
       RETURNING id`,
      [role.code, role.name, role.description],
    );
    const roleId = roleRes.rows[0]?.id
      ?? (await query<{ id: number }>('SELECT id FROM roles WHERE code = $1', [role.code])).rows[0]?.id;

    if (!roleId) continue;

    const hasPerms = await roleHasPermissions(roleId);
    if (hasPerms) continue;

    const codes = role.code === 'admin' ? ALL_PERMISSION_CODES : (DEFAULT_ROLE_PERMISSIONS[role.code] ?? []);
    await assignRolePermissions(roleId, codes);
  }
}

/** 加载用户有效权限（角色并集；超管拥有全部） */
export async function loadUserPermissions(userId: number, isSuperAdmin: boolean): Promise<string[]> {
  if (isSuperAdmin) return ALL_PERMISSION_CODES;

  const res = await query<{ code: string }>(
    `SELECT DISTINCT p.code FROM permissions p
     INNER JOIN role_permissions rp ON rp.permission_id = p.id
     INNER JOIN user_roles ur ON ur.role_id = rp.role_id
     WHERE ur.user_id = $1
     ORDER BY p.code`,
    [userId],
  );
  return res.rows.map((r) => r.code);
}

export async function listAllPermissions(): Promise<PermissionRow[]> {
  const res = await query<PermissionRow>(
    'SELECT id, code, name, module, sort_order FROM permissions ORDER BY module, sort_order, code',
  );
  return res.rows;
}

export function userHasPermission(
  user: { isSuperAdmin: boolean; permissions: string[] },
  code: string,
): boolean {
  if (user.isSuperAdmin) return true;
  return user.permissions.includes(code);
}

export function userHasAnyPermission(
  user: { isSuperAdmin: boolean; permissions: string[] },
  codes: string[],
): boolean {
  if (user.isSuperAdmin) return true;
  return codes.some((c) => user.permissions.includes(c));
}
