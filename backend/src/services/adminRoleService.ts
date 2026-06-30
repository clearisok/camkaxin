import { query } from '../config/database.js';
import { ALL_PERMISSION_CODES } from '../constants/permissions.js';

export interface AdminRoleRow {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permissions: string[];
}

export async function listRoles(): Promise<AdminRoleRow[]> {
  const rolesRes = await query<{
    id: number;
    code: string;
    name: string;
    description: string | null;
    is_system: boolean;
  }>('SELECT id, code, name, description, is_system FROM roles ORDER BY id');

  const permRes = await query<{ role_id: number; code: string }>(
    `SELECT rp.role_id, p.code FROM role_permissions rp
     INNER JOIN permissions p ON p.id = rp.permission_id
     ORDER BY p.code`,
  );

  const permMap = new Map<number, string[]>();
  for (const row of permRes.rows) {
    const list = permMap.get(row.role_id) ?? [];
    list.push(row.code);
    permMap.set(row.role_id, list);
  }

  return rolesRes.rows.map((r) => ({
    ...r,
    permissions: r.code === 'admin' ? ALL_PERMISSION_CODES : (permMap.get(r.id) ?? []),
  }));
}

export async function updateRolePermissions(roleId: number, codes: string[]): Promise<AdminRoleRow> {
  const roleRes = await query<{ id: number; code: string; name: string; description: string | null; is_system: boolean }>(
    'SELECT id, code, name, description, is_system FROM roles WHERE id = $1',
    [roleId],
  );
  const role = roleRes.rows[0];
  if (!role) throw new Error('角色不存在');
  if (role.code === 'admin') {
    throw new Error('系统管理员角色拥有全部权限，不可修改');
  }

  const permRes = await query<{ id: number; code: string }>(
    'SELECT id, code FROM permissions WHERE code = ANY($1::text[])',
    [codes],
  );

  await query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
  for (const perm of permRes.rows) {
    await query(
      'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [roleId, perm.id],
    );
  }

  const updated = await listRoles();
  const found = updated.find((r) => r.id === roleId);
  if (!found) throw new Error('角色不存在');
  return found;
}
