import { useEffect, useMemo, useState } from 'react';
import { Layout, Menu, Button } from 'antd';
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
} from '@ant-design/icons';
import BrandLogo from '@/components/BrandLogo';
import SchedulingHeaderTabs from '@/components/SchedulingHeaderTabs';

const { Sider, Header, Content } = Layout;

const CONFIG_OPEN_KEY = 'config';
const SIDER_WIDTH = 240;
const SIDER_COLLAPSED_WIDTH = 72;
const SIDER_COLLAPSED_STORAGE_KEY = 'jiankai-app-sider-collapsed';

const NAV_KEYS = [
  '/config/accessories',
  '/config/settings',
  '/config/fabrics',
  '/config/brands',
  '/config/agents',
  '/quotations',
  '/scheduling',
  '/',
] as const;

const menuItems: MenuProps['items'] = [
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
    ],
  },
  { key: '/config/settings', icon: <SettingOutlined />, label: '系统设置' },
];

function resolveSelectedKey(pathname: string): string {
  if (pathname === '/' || pathname === '') return '/';
  if (pathname.startsWith('/scheduling')) return '/scheduling';
  const matched = NAV_KEYS.find((key) => key !== '/' && pathname.startsWith(key));
  return matched ?? pathname;
}

function isConfigChildPath(pathname: string): boolean {
  return ['/config/agents', '/config/brands', '/config/fabrics', '/config/accessories'].some(
    (key) => pathname.startsWith(key)
  );
}

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const selectedKey = useMemo(
    () => resolveSelectedKey(location.pathname),
    [location.pathname]
  );

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDER_COLLAPSED_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const [openKeys, setOpenKeys] = useState<string[]>(() =>
    isConfigChildPath(location.pathname) ? [CONFIG_OPEN_KEY] : []
  );

  useEffect(() => {
    if (isConfigChildPath(location.pathname)) {
      setOpenKeys((prev) => (prev.includes(CONFIG_OPEN_KEY) ? prev : [...prev, CONFIG_OPEN_KEY]));
    }
  }, [location.pathname]);

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === CONFIG_OPEN_KEY || !key.startsWith('/')) return;
    navigate(key);
  };

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDER_COLLAPSED_STORAGE_KEY, next ? '1' : '0');
      } catch { /* ignore */ }
      return next;
    });
  };

  const siderWidth = collapsed ? SIDER_COLLAPSED_WIDTH : SIDER_WIDTH;
  const showSchedulingTabs = location.pathname === '/scheduling';

  return (
    <Layout className="h-screen overflow-hidden">
      <Sider
        width={SIDER_WIDTH}
        collapsedWidth={SIDER_COLLAPSED_WIDTH}
        collapsed={collapsed}
        theme="dark"
        trigger={null}
        className="shadow-lg !fixed left-0 top-0 bottom-0 z-10 flex flex-col app-sider"
        style={{ height: '100vh' }}
      >
        <div className={`h-16 flex-shrink-0 flex items-center justify-center border-b border-white/10 ${collapsed ? 'px-2' : 'px-4'}`}>
          <BrandLogo
            variant={collapsed ? 'sidebar-collapsed' : 'sidebar'}
            showName={!collapsed}
          />
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <Menu
            theme="dark"
            mode="inline"
            inlineCollapsed={collapsed}
            selectedKeys={[selectedKey]}
            openKeys={collapsed ? [] : openKeys}
            onOpenChange={setOpenKeys}
            items={menuItems}
            onClick={handleMenuClick}
            className="border-none mt-2 app-sidebar-menu"
          />
        </div>
      </Sider>
      <Layout
        className="h-screen flex flex-col transition-all duration-200 app-main-layout"
        style={{
          marginLeft: siderWidth,
          width: `calc(100vw - ${siderWidth}px)`,
          ['--app-sider-width' as string]: `${siderWidth}px`,
        }}
      >
        <Header className="bg-white px-4 md:px-6 shadow-sm flex items-center h-14 flex-shrink-0 leading-[56px]">
          <div className="app-header-inner">
            <Button
              type="text"
              className="!text-gray-500 shrink-0"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={toggleCollapsed}
              aria-label={collapsed ? '展开菜单' : '收起菜单'}
            />
            {showSchedulingTabs && <SchedulingHeaderTabs />}
          </div>
        </Header>
        <Content className="bg-[#f8fafc] flex-1 overflow-y-auto">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
