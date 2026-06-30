import type { Request, Response, NextFunction } from 'express';
import { COOKIE_NAME, resolveUserFromToken } from '../services/authService.js';
import type { AuthUser } from '../types/auth.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const PUBLIC_API_PATHS = new Set(['/auth/login']);

function extractToken(req: Request): string | null {
  const cookieToken = req.cookies?.[COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken) return cookieToken;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

/** 除公开路径外，所有 /api 请求需登录 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  if (PUBLIC_API_PATHS.has(req.path)) {
    next();
    return;
  }

  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: '未登录，请先登录' });
    return;
  }

  try {
    req.user = await resolveUserFromToken(token);
    next();
  } catch {
    res.status(401).json({ error: '登录已失效，请重新登录' });
  }
}

/** 路由级：必须已登录（用于 auth 路由内的 /me、/logout） */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: '未登录，请先登录' });
    return;
  }
  try {
    req.user = await resolveUserFromToken(token);
    next();
  } catch {
    res.status(401).json({ error: '登录已失效，请重新登录' });
  }
}
