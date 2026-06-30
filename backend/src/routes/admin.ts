import { Router, type Request, type Response } from 'express';
import { listAllPermissions } from '../services/permissionService.js';
import {
  createUser,
  deleteUser,
  listUsers,
  resetUserPassword,
  updateUser,
} from '../services/adminUserService.js';
import { listRoles, updateRolePermissions } from '../services/adminRoleService.js';
import {
  getRoleFieldPermissionsForAdmin,
  updateRoleFieldPermissions,
} from '../services/fieldPermissionService.js';
import { listFieldMetaCatalog } from '../constants/fieldPermissions.js';
import { requirePermission } from '../middleware/requirePermission.js';

const router = Router();

router.get('/permissions', requirePermission('admin.roles.manage'), async (_req: Request, res: Response) => {
  try {
    const permissions = await listAllPermissions();
    res.json({ data: permissions });
  } catch (err) {
    res.status(500).json({ error: String(err instanceof Error ? err.message : err) });
  }
});

router.get('/roles', requirePermission('admin.roles.manage'), async (_req: Request, res: Response) => {
  try {
    const roles = await listRoles();
    res.json({ data: roles });
  } catch (err) {
    res.status(500).json({ error: String(err instanceof Error ? err.message : err) });
  }
});

router.put('/roles/:id/permissions', requirePermission('admin.roles.manage'), async (req: Request, res: Response) => {
  try {
    const roleId = Number(req.params.id);
    const { codes } = req.body as { codes?: string[] };
    if (!Array.isArray(codes)) {
      res.status(400).json({ error: 'codes 必须为数组' });
      return;
    }
    const role = await updateRolePermissions(roleId, codes);
    res.json({ data: role });
  } catch (err) {
    res.status(400).json({ error: String(err instanceof Error ? err.message : err) });
  }
});

router.get('/field-meta', requirePermission('admin.roles.manage'), async (_req: Request, res: Response) => {
  try {
    res.json({ data: listFieldMetaCatalog() });
  } catch (err) {
    res.status(500).json({ error: String(err instanceof Error ? err.message : err) });
  }
});

router.get('/roles/:id/field-permissions', requirePermission('admin.roles.manage'), async (req: Request, res: Response) => {
  try {
    const roleId = Number(req.params.id);
    const roles = await listRoles();
    const role = roles.find((r) => r.id === roleId);
    if (!role) {
      res.status(404).json({ error: '角色不存在' });
      return;
    }
    const items = await getRoleFieldPermissionsForAdmin(roleId, role.code);
    res.json({ data: items });
  } catch (err) {
    res.status(500).json({ error: String(err instanceof Error ? err.message : err) });
  }
});

router.put('/roles/:id/field-permissions', requirePermission('admin.roles.manage'), async (req: Request, res: Response) => {
  try {
    const roleId = Number(req.params.id);
    const { items } = req.body as {
      items?: Array<{ fieldCode: string; visible: boolean; editable: boolean }>;
    };
    if (!Array.isArray(items)) {
      res.status(400).json({ error: 'items 必须为数组' });
      return;
    }
    const roles = await listRoles();
    const role = roles.find((r) => r.id === roleId);
    if (!role) {
      res.status(404).json({ error: '角色不存在' });
      return;
    }
    const data = await updateRoleFieldPermissions(roleId, role.code, items);
    res.json({ data });
  } catch (err) {
    res.status(400).json({ error: String(err instanceof Error ? err.message : err) });
  }
});

router.get('/users', requirePermission('admin.users.manage'), async (_req: Request, res: Response) => {
  try {
    const users = await listUsers();
    res.json({ data: users });
  } catch (err) {
    res.status(500).json({ error: String(err instanceof Error ? err.message : err) });
  }
});

router.post('/users', requirePermission('admin.users.manage'), async (req: Request, res: Response) => {
  try {
    const { username, password, displayName, email, roleCodes, isSuperAdmin } = req.body as {
      username?: string;
      password?: string;
      displayName?: string;
      email?: string;
      roleCodes?: string[];
      isSuperAdmin?: boolean;
    };
    const user = await createUser({
      username: String(username ?? ''),
      password: String(password ?? ''),
      displayName,
      email,
      roleCodes: roleCodes ?? [],
      isSuperAdmin,
    });
    res.status(201).json({ data: user });
  } catch (err) {
    res.status(400).json({ error: String(err instanceof Error ? err.message : err) });
  }
});

router.put('/users/:id', requirePermission('admin.users.manage'), async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);
    const { displayName, email, status, roleCodes, isSuperAdmin } = req.body as {
      displayName?: string;
      email?: string;
      status?: string;
      roleCodes?: string[];
      isSuperAdmin?: boolean;
    };
    const user = await updateUser(userId, { displayName, email, status, roleCodes, isSuperAdmin });
    res.json({ data: user });
  } catch (err) {
    res.status(400).json({ error: String(err instanceof Error ? err.message : err) });
  }
});

router.put('/users/:id/password', requirePermission('admin.users.manage'), async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);
    const { password } = req.body as { password?: string };
    await resetUserPassword(userId, String(password ?? ''));
    res.json({ data: { ok: true } });
  } catch (err) {
    res.status(400).json({ error: String(err instanceof Error ? err.message : err) });
  }
});

router.delete('/users/:id', requirePermission('admin.users.manage'), async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);
    await deleteUser(userId, req.user!.id);
    res.json({ data: { ok: true } });
  } catch (err) {
    res.status(400).json({ error: String(err instanceof Error ? err.message : err) });
  }
});

export default router;
