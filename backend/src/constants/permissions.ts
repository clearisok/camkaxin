export interface PermissionDef {
  code: string;
  name: string;
  module: string;
  sortOrder: number;
}

export const PERMISSION_DEFS: PermissionDef[] = [
  { code: 'menu.dashboard.view', name: '查看工作台', module: 'menu', sortOrder: 1 },
  { code: 'menu.quotations.view', name: '查看报价', module: 'menu', sortOrder: 2 },
  { code: 'menu.scheduling.view', name: '查看排单', module: 'menu', sortOrder: 3 },
  { code: 'menu.config.view', name: '查看配置', module: 'menu', sortOrder: 4 },

  { code: 'quotations.create', name: '新建报价', module: 'quotations', sortOrder: 10 },
  { code: 'quotations.update', name: '编辑报价', module: 'quotations', sortOrder: 11 },
  { code: 'quotations.delete', name: '删除报价', module: 'quotations', sortOrder: 12 },
  { code: 'quotations.export', name: '导出报价', module: 'quotations', sortOrder: 13 },

  { code: 'scheduling.view', name: '查看排单数据', module: 'scheduling', sortOrder: 20 },
  { code: 'scheduling.schedule', name: '确认排单', module: 'scheduling', sortOrder: 21 },
  { code: 'scheduling.move', name: '移动款式', module: 'scheduling', sortOrder: 22 },
  { code: 'scheduling.reorder', name: '组内排序', module: 'scheduling', sortOrder: 23 },
  { code: 'scheduling.offline', name: '下线操作', module: 'scheduling', sortOrder: 24 },
  { code: 'scheduling.outsource', name: '外发操作', module: 'scheduling', sortOrder: 25 },
  { code: 'scheduling.sandbox', name: '沙箱模式', module: 'scheduling', sortOrder: 26 },
  { code: 'scheduling.export', name: '预警导出', module: 'scheduling', sortOrder: 27 },
  { code: 'scheduling.style_edit', name: '编辑款式', module: 'scheduling', sortOrder: 28 },

  { code: 'config.agents.manage', name: '业务员管理', module: 'config', sortOrder: 30 },
  { code: 'config.brands.manage', name: '品牌管理', module: 'config', sortOrder: 31 },
  { code: 'config.fabrics.manage', name: '面料库管理', module: 'config', sortOrder: 32 },
  { code: 'config.accessories.manage', name: '辅料库管理', module: 'config', sortOrder: 33 },
  { code: 'config.holidays.manage', name: '假期管理', module: 'config', sortOrder: 34 },
  { code: 'config.settings.manage', name: '系统设置', module: 'config', sortOrder: 35 },

  { code: 'admin.users.manage', name: '用户管理', module: 'admin', sortOrder: 40 },
  { code: 'admin.roles.manage', name: '角色权限', module: 'admin', sortOrder: 41 },
];

export const ALL_PERMISSION_CODES = PERMISSION_DEFS.map((p) => p.code);

/** 内置角色默认权限（不含 admin 超集，admin 角色在 seed 时赋全部） */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  quotation_manager: [
    'menu.dashboard.view', 'menu.quotations.view', 'menu.config.view',
    'quotations.create', 'quotations.update', 'quotations.delete', 'quotations.export',
  ],
  sales: [
    'menu.dashboard.view', 'menu.quotations.view',
    'quotations.create', 'quotations.update', 'quotations.export',
  ],
  scheduler: [
    'menu.dashboard.view', 'menu.scheduling.view',
    'scheduling.view', 'scheduling.schedule', 'scheduling.move', 'scheduling.reorder',
    'scheduling.offline', 'scheduling.outsource', 'scheduling.sandbox', 'scheduling.export',
    'scheduling.style_edit', 'config.holidays.manage',
  ],
  viewer: [
    'menu.dashboard.view', 'menu.quotations.view', 'menu.scheduling.view', 'menu.config.view',
    'scheduling.view',
  ],
};

export const SYSTEM_ROLES: Array<{ code: string; name: string; description: string }> = [
  { code: 'admin', name: '系统管理员', description: '拥有全部功能权限' },
  { code: 'quotation_manager', name: '报价主管', description: '报价模块完整权限' },
  { code: 'sales', name: '业务员', description: '报价查看与新建编辑' },
  { code: 'scheduler', name: '排单员', description: '预警排单完整操作' },
  { code: 'viewer', name: '只读用户', description: '仅查看各模块' },
];

export const MODULE_LABELS: Record<string, string> = {
  menu: '菜单访问',
  quotations: '报价单',
  scheduling: '预警排单',
  config: '基础配置',
  admin: '系统管理',
};
