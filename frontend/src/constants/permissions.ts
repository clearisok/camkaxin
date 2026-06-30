export const MODULE_LABELS: Record<string, string> = {
  menu: '菜单访问',
  quotations: '报价单',
  scheduling: '预警排单',
  config: '基础配置',
  admin: '系统管理',
};

export const MENU_PERMISSION_MAP: Record<string, string | string[]> = {
  '/': 'menu.dashboard.view',
  '/quotations': 'menu.quotations.view',
  '/scheduling': 'menu.scheduling.view',
  '/config/agents': 'config.agents.manage',
  '/config/brands': 'config.brands.manage',
  '/config/fabrics': 'config.fabrics.manage',
  '/config/accessories': 'config.accessories.manage',
  '/config/holidays': 'config.holidays.manage',
  '/config/settings': 'config.settings.manage',
  '/config/users': 'admin.users.manage',
  '/config/roles': 'admin.roles.manage',
};

/** 基础配置子菜单：任一 config.*.manage 或 menu.config.view 可见父级 */
export const CONFIG_CHILD_KEYS = [
  '/config/agents',
  '/config/brands',
  '/config/fabrics',
  '/config/accessories',
  '/config/holidays',
  '/config/users',
  '/config/roles',
];
