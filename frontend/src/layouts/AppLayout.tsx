import { memo, useEffect, useMemo, useState } from 'react';
import { Layout, Menu, Button, ConfigProvider, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  FileTextOutlined,
  SettingOutlined,
  TeamOutlined,
  TagOutlined,
  SkinOutlined,
  ToolOutlined,
  HomeOutlined,
  AppstoreOutlined,
  CalendarOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
  SafetyOutlined,
  UsergroupAddOutlined,
  ArrowLeftOutlined,
  HistoryOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import BrandLogo from '@/components/BrandLogo';
import SchedulingHeaderTabs from '@/components/SchedulingHeaderTabs';
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';
import { HeaderActionsProvider, useHeaderActionsConfig } from '@/contexts/HeaderActionsContext';
import { useAuth } from '@/contexts/AuthContext';
import { CONFIG_CHILD_KEYS, MENU_PERMISSION_MAP } from '@/constants/permissions';

const { Sider, Header, Content } = Layout;

const CONFIG_OPEN_KEY = 'config';
const SIDER_WIDTH = 260;
const SIDER_COLLAPSED_WIDTH = 72;

const PAGE_TITLES: Record<string, string> = {
  '/': '工作台',
  '/quotations': '报价单管理',
  '/scheduling': '预警排单',
  '/config/agents': '业务员管理',
  '/config/brands': '品牌管理',
  '/config/fabrics': '面料库',
  '/config/accessories': '辅料库',
  '/config/holidays': '假期管理',
  '/config/settings': '系统设置',
  '/config/users': '用户管理',
  '/config/roles': '角色权限',
};

function isStyleDetailPath(pathname: string): boolean {
  return /^\/scheduling\/styles\/\d+$/.test(pathname);
}

function resolvePageTitle(pathname: string): string {
  if (pathname.startsWith('/quotations/new') || /^\/quotations\/\d+/.test(pathname)) return '';
  if (pathname.startsWith('/scheduling/styles/new')) return '新建款式';
  if (isStyleDetailPath(pathname)) return '';
  const matched = NAV_KEYS.find((key) => key !== '/' && pathname.startsWith(key));
  return matched ? (PAGE_TITLES[matched] ?? '柬凯内部系统') : '柬凯内部系统';
}

const NAV_KEYS = [
  '/config/accessories',
  '/config/holidays',
  '/config/settings',
  '/config/fabrics',
  '/config/brands',
  '/config/agents',
  '/config/users',
  '/config/roles',
  '/quotations',
  '/scheduling',
  '/',
] as const;

const ALL_MENU_ITEMS: MenuProps['items'] = [
  { key: '/', icon: <HomeOutlined />, label: '工作台' },
  { key: '/quotations', icon: <FileTextOutlined />, label: '报价单管理' },
  { key: '/scheduling', icon: <CalendarOutlined />, label: '预警排单' },
  { type: 'divider' },
  {
    key: CONFIG_OPEN_KEY,
    icon: <AppstoreOutlined />,
    label: '基础配置',
    children: [
      { key: '/config/agents', icon: <TeamOutlined />, label: '业务员管理' },
      { key: '/config/brands', icon: <TagOutlined />, label: '品牌管理' },
      { key: '/config/fabrics', icon: <SkinOutlined />, label: '面料库' },
      { key: '/config/accessories', icon: <ToolOutlined />, label: '辅料库' },
      { key: '/config/holidays', icon: <CalendarOutlined />, label: '假期管理' },
      { key: '/config/users', icon: <UsergroupAddOutlined />, label: '用户管理' },
      { key: '/config/roles', icon: <SafetyOutlined />, label: '角色权限' },
    ],
  },
  { key: '/config/settings', icon: <SettingOutlined />, label: '系统设置' },
];

function canAccessMenuKey(
  key: string,
  hasPermission: (code: string) => boolean,
  hasAnyPermission: (codes: string[]) => boolean,
): boolean {
  const perm = MENU_PERMISSION_MAP[key];
  if (!perm) return true;
  if (Array.isArray(perm)) return hasAnyPermission(perm);
  return hasPermission(perm);
}

function filterMenuItems(
  items: MenuProps['items'],
  hasPermission: (code: string) => boolean,
  hasAnyPermission: (codes: string[]) => boolean,
): MenuProps['items'] {
  if (!items) return [];
  return items
    .map((item) => {
      if (!item || item.type === 'divider') return item;
      if ('children' in item && item.children) {
        const children = filterMenuItems(item.children, hasPermission, hasAnyPermission);
        if (!children?.length) return null;
        return { ...item, children };
      }
      const key = String(item.key ?? '');
      if (!canAccessMenuKey(key, hasPermission, hasAnyPermission)) return null;
      return item;
    })
    .filter(Boolean) as MenuProps['items'];
}

const siderMenuTheme = {
  components: {
    Menu: {
      collapsedWidth: SIDER_COLLAPSED_WIDTH,
      motionDurationSlow: '0.12s',
      motionDurationMid: '0.12s',
      motionDurationFast: '0.08s',
    },
  },
};

function resolveSelectedKey(pathname: string): string {
  if (pathname === '/' || pathname === '') return '/';
  if (pathname.startsWith('/scheduling')) return '/scheduling';
  const matched = NAV_KEYS.find((key) => key !== '/' && pathname.startsWith(key));
  return matched ?? pathname;
}

function isConfigChildPath(pathname: string): boolean {
  return CONFIG_CHILD_KEYS.some((key) => pathname.startsWith(key));
}

function SidebarToggle() {
  const { collapsed, toggleCollapsed } = useSidebar();

  return (
    <Button
      type="text"
      className="app-sidebar-toggle shrink-0"
      icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
      onClick={toggleCollapsed}
      aria-label={collapsed ? '展开菜单' : '收起菜单'}
    />
  );
}

function AppSider() {
  const navigate = useNavigate();
  const location = useLocation();
  const { collapsed } = useSidebar();
  const { hasPermission, hasAnyPermission } = useAuth();

  const menuItems = useMemo(
    () => filterMenuItems(ALL_MENU_ITEMS, hasPermission, hasAnyPermission),
    [hasPermission, hasAnyPermission],
  );

  const selectedKey = useMemo(
    () => resolveSelectedKey(location.pathname),
    [location.pathname]
  );

  const [openKeys, setOpenKeys] = useState<string[]>(() =>
    isConfigChildPath(location.pathname) ? [CONFIG_OPEN_KEY] : []
  );
  const [menuOpenKeys, setMenuOpenKeys] = useState(() =>
    collapsed ? [] : openKeys
  );

  useEffect(() => {
    if (isConfigChildPath(location.pathname)) {
      setOpenKeys((prev) => (prev.includes(CONFIG_OPEN_KEY) ? prev : [...prev, CONFIG_OPEN_KEY]));
    }
  }, [location.pathname]);

  useEffect(() => {
    setMenuOpenKeys(collapsed ? [] : openKeys);
  }, [collapsed, openKeys]);

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === CONFIG_OPEN_KEY || !key.startsWith('/')) return;
    navigate(key);
  };

  return (
    <Sider
      width={SIDER_WIDTH}
      collapsedWidth={SIDER_COLLAPSED_WIDTH}
      collapsed={collapsed}
      theme="dark"
      trigger={null}
      className="shadow-lg !fixed left-0 top-0 bottom-0 z-10 flex flex-col app-sider"
      style={{ height: '100vh' }}
    >
      <div
        className={`app-sider-brand h-16 flex-shrink-0 flex items-center justify-center border-b border-white/10 ${collapsed ? 'is-collapsed' : ''}`}
      >
        <BrandLogo variant="sidebar" showName collapsed={collapsed} />
      </div>
      <div className="app-sidebar-scroll flex-1 overflow-y-auto overflow-x-hidden">
        <ConfigProvider theme={siderMenuTheme}>
          <Menu
            theme="dark"
            mode="inline"
            inlineCollapsed={collapsed}
            selectedKeys={[selectedKey]}
            openKeys={menuOpenKeys}
            onOpenChange={(keys) => {
              setOpenKeys(keys);
              if (!collapsed) setMenuOpenKeys(keys);
            }}
            items={menuItems}
            onClick={handleMenuClick}
            className="border-none mt-2 app-sidebar-menu"
          />
        </ConfigProvider>
      </div>
    </Sider>
  );
}

const AppMain = memo(function AppMain() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const headerActions = useHeaderActionsConfig();
  const showSchedulingTabs = location.pathname === '/scheduling';
  const pageTitle = useMemo(() => resolvePageTitle(location.pathname), [location.pathname]);
  const showPageTitle = Boolean(pageTitle);

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
    },
  ];

  const handleUserMenuClick: MenuProps['onClick'] = async ({ key }) => {
    if (key === 'logout') {
      await logout();
      navigate('/login', { replace: true });
    }
  };

  return (
    <Layout className="h-screen flex flex-col app-main-layout">
      <Header className={`app-top-header${showSchedulingTabs ? ' has-view-switcher' : ''}`}>
        <div className="app-header-inner">
          {headerActions.back && headerActions.onBack && (
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={headerActions.onBack}
              className="app-header-back-btn"
            >
              返回
            </Button>
          )}
          <SidebarToggle />
          <div className="app-header-leading">
            {showPageTitle && <h1 className="app-header-title">{pageTitle}</h1>}
            {showSchedulingTabs && (
              <div className="app-header-switcher">
                <SchedulingHeaderTabs />
              </div>
            )}
          </div>
          <div className="app-header-trailing">
            {(headerActions.history || headerActions.save) && (
              <div className="app-header-actions">
                {headerActions.history && headerActions.onHistory && (
                  <Button icon={<HistoryOutlined />} onClick={headerActions.onHistory}>
                    变更历史
                  </Button>
                )}
                {headerActions.save && headerActions.onSave && (
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={headerActions.saving}
                    onClick={headerActions.onSave}
                  >
                    保存
                  </Button>
                )}
              </div>
            )}
            <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenuClick }} placement="bottomRight">
              <Button type="text" className="app-header-user" icon={<UserOutlined />}>
                {user?.displayName || user?.username || '用户'}
              </Button>
            </Dropdown>
          </div>
        </div>
      </Header>
      <Content className="app-main-content flex-1 overflow-y-auto">
        <Outlet />
      </Content>
    </Layout>
  );
});

export default function AppLayout() {
  return (
    <SidebarProvider>
      <HeaderActionsProvider>
        <Layout className="h-screen overflow-hidden">
          <AppSider />
          <AppMain />
        </Layout>
      </HeaderActionsProvider>
    </SidebarProvider>
  );
}
