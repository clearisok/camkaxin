import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { query } from '../config/database.js';
import type { AuthUser, JwtPayload } from '../types/auth.js';
import { loadUserPermissions } from './permissionService.js';
import { loadUserFieldPermissions } from './fieldPermissionService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
const JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL || '8h';
const COOKIE_NAME = 'access_token';

export { COOKIE_NAME, JWT_SECRET };

interface UserRow {
  id: number;
  username: string;
  display_name: string | null;
  password_hash: string;
  status: string;
  is_super_admin: boolean;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signAccessToken(user: { id: number; username: string }): string {
  return jwt.sign(
    { sub: user.id, username: user.username } satisfies JwtPayload,
    JWT_SECRET,
    { expiresIn: JWT_ACCESS_TTL as SignOptions['expiresIn'] },
  );
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (typeof decoded === 'string' || decoded.sub == null) {
    throw new Error('无效的登录凭证');
  }
  const sub = Number(decoded.sub);
  if (!Number.isFinite(sub)) {
    throw new Error('无效的登录凭证');
  }
  return {
    sub,
    username: String(decoded.username ?? ''),
  };
}

async function loadUserRoles(userId: number): Promise<string[]> {
  const res = await query<{ code: string }>(
    `SELECT r.code FROM roles r
     INNER JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = $1
     ORDER BY r.code`,
    [userId],
  );
  return res.rows.map((r) => r.code);
}

export async function findUserByUsername(username: string): Promise<UserRow | null> {
  const res = await query<UserRow>(
    'SELECT id, username, display_name, password_hash, status, is_super_admin FROM users WHERE username = $1',
    [username.trim().toLowerCase()],
  );
  return res.rows[0] ?? null;
}

export async function findUserById(id: number): Promise<UserRow | null> {
  const res = await query<UserRow>(
    'SELECT id, username, display_name, password_hash, status, is_super_admin FROM users WHERE id = $1',
    [id],
  );
  return res.rows[0] ?? null;
}

export async function toAuthUser(row: UserRow): Promise<AuthUser> {
  const roles = await loadUserRoles(row.id);
  const [permissions, fieldPermissions] = await Promise.all([
    loadUserPermissions(row.id, row.is_super_admin),
    loadUserFieldPermissions(row.id, row.is_super_admin, roles),
  ]);
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    isSuperAdmin: row.is_super_admin,
    roles,
    permissions,
    fieldPermissions,
  };
}

export async function login(username: string, password: string): Promise<{ user: AuthUser; token: string }> {
  const normalized = username.trim().toLowerCase();
  if (!normalized || !password) {
    throw new Error('请输入用户名和密码');
  }

  const row = await findUserByUsername(normalized);
  if (!row) {
    throw new Error('用户名或密码错误');
  }
  if (row.status !== 'active') {
    throw new Error('账号已停用，请联系管理员');
  }

  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) {
    throw new Error('用户名或密码错误');
  }

  await query('UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1', [row.id]);

  const user = await toAuthUser(row);
  const token = signAccessToken({ id: row.id, username: row.username });
  return { user, token };
}

export async function resolveUserFromToken(token: string): Promise<AuthUser> {
  const payload = verifyAccessToken(token);
  const row = await findUserById(payload.sub);
  if (!row || row.status !== 'active') {
    throw new Error('登录已失效，请重新登录');
  }
  return toAuthUser(row);
}

export function cookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  maxAge: number;
  path: string;
} {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  };
}
