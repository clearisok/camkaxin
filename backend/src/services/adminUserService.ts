import { query } from '../config/database.js';
import { hashPassword } from './authService.js';

export interface AdminUserRow {
  id: number;
  username: string;
  display_name: string | null;
  email: string | null;
  status: string;
  is_super_admin: boolean;
  last_login_at: string | null;
  created_at: string;
  roles: string[];
}

interface UserBaseRow {
  id: number;
  username: string;
  display_name: string | null;
  email: string | null;
  status: string;
  is_super_admin: boolean;
  last_login_at: string | null;
  created_at: string;
}

async function loadRolesForUsers(userIds: number[]): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();
  if (userIds.length === 0) return map;

  const res = await query<{ user_id: number; code: string }>(
    `SELECT ur.user_id, r.code FROM user_roles ur
     INNER JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = ANY($1::int[])
     ORDER BY r.code`,
    [userIds],
  );
  for (const row of res.rows) {
    const list = map.get(row.user_id) ?? [];
    list.push(row.code);
    map.set(row.user_id, list);
  }
  return map;
}

function toAdminUser(row: UserBaseRow, roles: string[]): AdminUserRow {
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    email: row.email,
    status: row.status,
    is_super_admin: row.is_super_admin,
    last_login_at: row.last_login_at,
    created_at: row.created_at,
    roles,
  };
}

export async function listUsers(): Promise<AdminUserRow[]> {
  const res = await query<UserBaseRow>(
    `SELECT id, username, display_name, email, status, is_super_admin, last_login_at, created_at
     FROM users ORDER BY id`,
  );
  const roleMap = await loadRolesForUsers(res.rows.map((r) => r.id));
  return res.rows.map((r) => toAdminUser(r, roleMap.get(r.id) ?? []));
}

export async function createUser(input: {
  username: string;
  password: string;
  displayName?: string;
  email?: string;
  roleCodes: string[];
  isSuperAdmin?: boolean;
}): Promise<AdminUserRow> {
  const username = input.username.trim().toLowerCase();
  if (!username || !input.password) {
    throw new Error('用户名和密码不能为空');
  }

  const passwordHash = await hashPassword(input.password);
  const userRes = await query<UserBaseRow>(
    `INSERT INTO users (username, display_name, email, password_hash, is_super_admin, status)
     VALUES ($1, $2, $3, $4, $5, 'active')
     RETURNING id, username, display_name, email, status, is_super_admin, last_login_at, created_at`,
    [
      username,
      input.displayName?.trim() || null,
      input.email?.trim() || null,
      passwordHash,
      input.isSuperAdmin ?? false,
    ],
  );
  const user = userRes.rows[0];
  await syncUserRoles(user.id, input.roleCodes);
  const roles = await loadRolesForUsers([user.id]);
  return toAdminUser(user, roles.get(user.id) ?? []);
}

export async function updateUser(
  userId: number,
  input: {
    displayName?: string;
    email?: string;
    status?: string;
    roleCodes?: string[];
    isSuperAdmin?: boolean;
  },
): Promise<AdminUserRow> {
  const existing = await query<UserBaseRow>(
    'SELECT id, username, display_name, email, status, is_super_admin, last_login_at, created_at FROM users WHERE id = $1',
    [userId],
  );
  const row = existing.rows[0];
  if (!row) throw new Error('用户不存在');

  await query(
    `UPDATE users SET
       display_name = COALESCE($2, display_name),
       email = COALESCE($3, email),
       status = COALESCE($4, status),
       is_super_admin = COALESCE($5, is_super_admin),
       updated_at = NOW()
     WHERE id = $1`,
    [
      userId,
      input.displayName !== undefined ? (input.displayName.trim() || null) : null,
      input.email !== undefined ? (input.email.trim() || null) : null,
      input.status ?? null,
      input.isSuperAdmin ?? null,
    ],
  );

  if (input.roleCodes) {
    await syncUserRoles(userId, input.roleCodes);
  }

  const updated = await query<UserBaseRow>(
    'SELECT id, username, display_name, email, status, is_super_admin, last_login_at, created_at FROM users WHERE id = $1',
    [userId],
  );
  const roles = await loadRolesForUsers([userId]);
  return toAdminUser(updated.rows[0], roles.get(userId) ?? []);
}

export async function resetUserPassword(userId: number, password: string): Promise<void> {
  if (!password) throw new Error('密码不能为空');
  const hash = await hashPassword(password);
  const res = await query('UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1', [userId, hash]);
  if (res.rowCount === 0) throw new Error('用户不存在');
}

async function syncUserRoles(userId: number, roleCodes: string[]): Promise<void> {
  await query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
  if (roleCodes.length === 0) return;

  const roleRes = await query<{ id: number; code: string }>(
    'SELECT id, code FROM roles WHERE code = ANY($1::text[])',
    [roleCodes],
  );
  for (const role of roleRes.rows) {
    await query(
      'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, role.id],
    );
  }
}

export async function deleteUser(userId: number, currentUserId: number): Promise<void> {
  if (userId === currentUserId) {
    throw new Error('不能删除当前登录账号');
  }
  const res = await query('DELETE FROM users WHERE id = $1', [userId]);
  if (res.rowCount === 0) throw new Error('用户不存在');
}
