import type { Request, Response, NextFunction } from 'express';
import { userHasPermission } from '../services/permissionService.js';

interface RouteRule {
  methods: string[];
  test: (path: string) => boolean;
  permission: string;
}

const ROUTE_RULES: RouteRule[] = [
  { methods: ['GET'], test: (p) => p === '/quotations' || /^\/quotations\//.test(p), permission: 'menu.quotations.view' },
  { methods: ['POST'], test: (p) => p === '/quotations', permission: 'quotations.create' },
  { methods: ['PUT', 'PATCH'], test: (p) => /^\/quotations\/\d+/.test(p) || p.startsWith('/quotations/items/'), permission: 'quotations.update' },
  { methods: ['DELETE'], test: (p) => p.startsWith('/quotations'), permission: 'quotations.delete' },
  { methods: ['POST'], test: (p) => p.startsWith('/quotations') && p.includes('export'), permission: 'quotations.export' },

  { methods: ['GET'], test: (p) => p.startsWith('/styles'), permission: 'scheduling.view' },
  { methods: ['POST'], test: (p) => p.includes('/sandbox-preview'), permission: 'scheduling.sandbox' },
  { methods: ['POST'], test: (p) => p.endsWith('/schedule'), permission: 'scheduling.schedule' },
  { methods: ['POST'], test: (p) => p.endsWith('/move'), permission: 'scheduling.move' },
  { methods: ['POST'], test: (p) => p.endsWith('/reorder'), permission: 'scheduling.reorder' },
  { methods: ['POST'], test: (p) => p.includes('/offline') || p.includes('batch-offline'), permission: 'scheduling.offline' },
  { methods: ['POST'], test: (p) => p.endsWith('/outsource') || p.includes('preview-outsource'), permission: 'scheduling.outsource' },
  { methods: ['POST', 'PUT', 'PATCH'], test: (p) => p.startsWith('/styles'), permission: 'scheduling.style_edit' },

  { methods: ['GET', 'POST', 'PUT', 'DELETE'], test: (p) => p.startsWith('/agents'), permission: 'config.agents.manage' },
  { methods: ['GET', 'POST', 'PUT', 'DELETE'], test: (p) => p.startsWith('/brands'), permission: 'config.brands.manage' },
  { methods: ['GET', 'POST', 'PUT', 'DELETE'], test: (p) => p.startsWith('/fabrics'), permission: 'config.fabrics.manage' },
  { methods: ['GET', 'POST', 'PUT', 'DELETE'], test: (p) => p.startsWith('/accessories'), permission: 'config.accessories.manage' },
  { methods: ['GET', 'POST', 'PUT', 'DELETE'], test: (p) => p.startsWith('/calendar-exceptions'), permission: 'config.holidays.manage' },
  { methods: ['GET', 'POST', 'PUT', 'DELETE'], test: (p) => p.startsWith('/settings'), permission: 'config.settings.manage' },

  { methods: ['GET', 'POST', 'PUT', 'DELETE'], test: (p) => p.startsWith('/admin/users'), permission: 'admin.users.manage' },
  { methods: ['GET', 'PUT'], test: (p) => p.startsWith('/admin/roles') || p.startsWith('/admin/permissions') || p.startsWith('/admin/field-meta'), permission: 'admin.roles.manage' },
];

const SKIP_PREFIXES = ['/auth', '/health'];

function matchRule(method: string, path: string): string | null {
  for (const rule of ROUTE_RULES) {
    if (rule.methods.includes(method) && rule.test(path)) {
      return rule.permission;
    }
  }
  return null;
}

/** 对已登录请求按路由规则校验功能权限 */
export function routePermissionGuard(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    next();
    return;
  }

  const path = req.path;
  if (SKIP_PREFIXES.some((p) => path.startsWith(p))) {
    next();
    return;
  }

  if (req.user.isSuperAdmin) {
    next();
    return;
  }

  const permission = matchRule(req.method, path);
  if (!permission) {
    next();
    return;
  }

  if (!userHasPermission(req.user, permission)) {
    res.status(403).json({ error: '无权限执行此操作' });
    return;
  }

  next();
}
