import { Layout, Menu } from 'antd';
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
} from '@ant-design/icons';

const { Sider, Header, Content } = Layout;

const menuItems = [
  { key: '/', icon: <HomeOutlined />, label: '工作台' },
  { key: '/quotations', icon: <FileTextOutlined />, label: '报价单管理' },
  { type: 'divider' as const },
  { key: 'config', label: '基础配置', type: 'group' as const, children: [
    { key: '/config/agents', icon: <TeamOutlined />, label: '业务员管理' },
    { key: '/config/brands', icon: <TagOutlined />, label: '品牌管理' },
    { key: '/config/fabrics', icon: <SkinOutlined />, label: '面料库' },
    { key: '/config/accessories', icon: <ToolOutlined />, label: '辅料库' },
  ]},
  { key: '/config/settings', icon: <SettingOutlined />, label: '系统设置' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const selectedKey = (() => {
    for (const item of menuItems) {
      if ('children' in item && item.children) {
        for (const child of item.children) {
          if ('key' in child && location.pathname.startsWith(child.key as string)) {
            return child.key as string;
          }
        }
      } else if ('key' in item && location.pathname.startsWith(item.key as string)) {
        return item.key as string;
      }
    }
    return location.pathname;
  })();

  return (
    <Layout className="min-h-screen">
      <Sider width={240} theme="dark" className="shadow-lg">
        <div className="h-16 flex items-center justify-center border-b border-white/10">
          <div className="text-white font-bold text-lg tracking-wide">
            <DollarOutlined className="mr-2" />
            柬凯报价系统
          </div>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          className="border-none mt-2"
        />
      </Sider>
      <Layout>
        <Header className="bg-white px-6 shadow-sm flex items-center justify-between h-14 leading-[56px]">
          <span className="text-gray-500 text-sm">柬凯内部管理系统 · 报价模块</span>
        </Header>
        <Content className="bg-[#f8fafc] min-h-[calc(100vh-56px)]">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
