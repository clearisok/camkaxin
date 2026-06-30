import type { Request, Response, NextFunction } from 'express';
import { userHasAnyPermission, userHasPermission } from '../services/permissionService.js';

/** 要求拥有指定权限之一（超管自动通过） */
export function requirePermission(...codes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: '未登录，请先登录' });
      return;
    }
    if (userHasAnyPermission(req.user, codes)) {
      next();
      return;
    }
    res.status(403).json({ error: '无权限执行此操作' });
  };
}

/** 单权限快捷 */
export function requireOnePermission(code: string) {
  return requirePermission(code);
}

export function checkPermission(user: NonNullable<Request['user']>, code: string): boolean {
  return userHasPermission(user, code);
}
