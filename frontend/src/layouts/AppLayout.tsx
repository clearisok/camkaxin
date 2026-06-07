import { useEffect, useMemo, useState } from 'react';
import { Layout, Menu } from 'antd';
import type { MenuProps } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  FileTextOutlined,
  SettingOutlined,
  TeamOutlined,
  TagOutlined,
  SkinOutlined,
  ToolOutlined,
  DollarOutlined,
  HomeOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';

const { Sider, Header, Content } = Layout;

const CONFIG_OPEN_KEY = 'config';

const NAV_KEYS = [
  '/config/accessories',
  '/config/settings',
  '/config/fabrics',
  '/config/brands',
  '/config/agents',
  '/quotations',
  '/',
] as const;

const menuItems: MenuProps['items'] = [
  { key: '/', icon: <HomeOutlined />, label: '工作台' },
  { key: '/quotations', icon: <FileTextOutlined />, label: '报价单管理' },
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

  return (
    <Layout className="h-screen overflow-hidden">
      <Sider
        width={240}
        theme="dark"
        className="shadow-lg !fixed left-0 top-0 bottom-0 z-10 flex flex-col app-sider"
        style={{ height: '100vh' }}
      >
        <div className="h-16 flex-shrink-0 flex items-center justify-center border-b border-white/10">
          <div className="text-white font-bold text-lg tracking-wide">
            <DollarOutlined className="mr-2" />
            柬凯报价系统
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
            openKeys={openKeys}
            onOpenChange={setOpenKeys}
            items={menuItems}
            onClick={handleMenuClick}
            className="border-none mt-2 app-sidebar-menu"
          />
        </div>
      </Sider>
      <Layout className="ml-[240px] h-screen flex flex-col">
        <Header className="bg-white px-6 shadow-sm flex items-center justify-between h-14 flex-shrink-0 leading-[56px]">
          <span className="text-gray-500 text-sm">柬凯内部管理系统 · 报价模块</span>
        </Header>
        <Content className="bg-[#f8fafc] flex-1 overflow-y-auto">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
