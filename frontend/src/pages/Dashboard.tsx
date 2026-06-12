import { Button } from 'antd';
import {
  FileTextOutlined,
  PlusOutlined,
  TagOutlined,
  SkinOutlined,
  CalendarOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getQuotations, getBrands, getFabrics } from '@/api';
import PageHeader from '@/components/PageHeader';
import { APP_SUBTITLE, APP_SYSTEM_NAME } from '@/constants/brand';

const QUICK_LINKS = [
  { label: '新建报价单', path: '/quotations/new', icon: <PlusOutlined />, primary: true },
  { label: '报价单列表', path: '/quotations', icon: <FileTextOutlined /> },
  { label: '预警排单', path: '/scheduling', icon: <CalendarOutlined /> },
  { label: '品牌管理', path: '/config/brands', icon: <TagOutlined /> },
  { label: '业务员', path: '/config/agents', icon: <TeamOutlined /> },
  { label: '系统设置', path: '/config/settings', icon: <SettingOutlined /> },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ quotations: 0, brands: 0, fabrics: 0, drafts: 0 });

  useEffect(() => {
    Promise.all([
      getQuotations({ pageSize: 1 }),
      getBrands(),
      getFabrics(),
      getQuotations({ status: 'draft', pageSize: 1 }),
    ])
      .then(([q, b, f, d]) => {
        setStats({
          quotations: q.total || 0,
          brands: b.data?.length || 0,
          fabrics: f.data?.length || 0,
          drafts: d.total || 0,
        });
      })
      .catch(() => {});
  }, []);

  const statItems = [
    { label: '报价单总数', value: stats.quotations, icon: <FileTextOutlined /> },
    { label: '草稿报价', value: stats.drafts, icon: <FileTextOutlined />, accent: true },
    { label: '品牌数量', value: stats.brands, icon: <TagOutlined /> },
    { label: '面料库', value: stats.fabrics, icon: <SkinOutlined /> },
  ];

  return (
    <div className="page-container">
      <section className="welcome-banner">
        <div>
          <p className="welcome-banner-eyebrow">{APP_SYSTEM_NAME}</p>
          <h2 className="welcome-banner-title">工作台</h2>
          <p className="welcome-banner-desc">{APP_SUBTITLE} — 从下方入口快速开始今天的工作</p>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          onClick={() => navigate('/quotations/new')}
        >
          新建报价单
        </Button>
      </section>

      <div className="stat-grid">
        {statItems.map((item) => (
          <article
            key={item.label}
            className={`stat-card${item.accent ? ' stat-card-accent' : ''}`}
          >
            <span className="stat-card-icon">{item.icon}</span>
            <div>
              <p className="stat-card-label">{item.label}</p>
              <p className="stat-card-value">{item.value}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="dashboard-grid">
        <section className="card-panel">
          <h3 className="section-title">快速入口</h3>
          <div className="quick-link-grid">
            {QUICK_LINKS.map((link) => (
              <button
                key={link.path}
                type="button"
                className={`quick-link${link.primary ? ' quick-link-primary' : ''}`}
                onClick={() => navigate(link.path)}
              >
                <span className="quick-link-icon">{link.icon}</span>
                <span>{link.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="card-panel">
          <h3 className="section-title">使用提示</h3>
          <ul className="hint-list">
            <li>选择品牌后自动关联业务员，并加载品牌基础辅料</li>
            <li>工价以 USD 计价，其余费用以 RMB 计价</li>
            <li>工价换算：USD × 汇率 × 1.13</li>
            <li>面料/辅料使用后自动沉淀到库中</li>
            <li>支持 Excel 模板导出，占位符自动填充</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
