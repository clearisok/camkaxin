import { Button, Tag, Skeleton, Empty } from 'antd';
import {
  FileTextOutlined,
  PlusOutlined,
  TagOutlined,
  SkinOutlined,
  CalendarOutlined,
  SettingOutlined,
  TeamOutlined,
  ToolOutlined,
  SafetyOutlined,
  UsergroupAddOutlined,
  ArrowRightOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { APP_SUBTITLE, APP_SYSTEM_NAME } from '@/constants/brand';
import type { Quotation } from '@/types';
import type { StyleRecord } from '@/types/style';

const ROLE_LABELS: Record<string, string> = {
  admin: '系统管理员',
  quotation_manager: '报价主管',
  sales: '业务员',
  scheduler: '排单员',
  viewer: '只读用户',
};

const QUOTATION_STATUS: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'default' },
  sent: { text: '已发送', color: 'processing' },
  confirmed: { text: '已确认', color: 'success' },
  expired: { text: '已过期', color: 'error' },
};

interface QuickLink {
  label: string;
  path: string;
  icon: React.ReactNode;
  permission?: string;
  primary?: boolean;
}

interface ModuleGroup {
  key: string;
  title: string;
  desc: string;
  permission: string;
  accent: string;
  links: QuickLink[];
}

const MODULE_GROUPS: ModuleGroup[] = [
  {
    key: 'quotations',
    title: '报价中心',
    desc: '新建、编辑与导出报价单',
    permission: 'menu.quotations.view',
    accent: '#2563eb',
    links: [
      { label: '新建报价单', path: '/quotations/new', icon: <PlusOutlined />, permission: 'quotations.create', primary: true },
      { label: '报价单列表', path: '/quotations', icon: <FileTextOutlined /> },
    ],
  },
  {
    key: 'scheduling',
    title: '预警排单',
    desc: '柬埔寨生产预警、排单与关账',
    permission: 'menu.scheduling.view',
    accent: '#059669',
    links: [
      { label: '进入排单', path: '/scheduling', icon: <CalendarOutlined />, primary: true },
      { label: '新建款式', path: '/scheduling/styles/new', icon: <PlusOutlined />, permission: 'scheduling.style_edit' },
    ],
  },
  {
    key: 'config',
    title: '基础配置',
    desc: '品牌、面料、辅料与假期',
    permission: 'config.brands.manage',
    accent: '#7c3aed',
    links: [
      { label: '品牌管理', path: '/config/brands', icon: <TagOutlined />, permission: 'config.brands.manage' },
      { label: '面料库', path: '/config/fabrics', icon: <SkinOutlined />, permission: 'config.fabrics.manage' },
      { label: '辅料库', path: '/config/accessories', icon: <ToolOutlined />, permission: 'config.accessories.manage' },
      { label: '业务员', path: '/config/agents', icon: <TeamOutlined />, permission: 'config.agents.manage' },
      { label: '假期管理', path: '/config/holidays', icon: <CalendarOutlined />, permission: 'config.holidays.manage' },
      { label: '系统设置', path: '/config/settings', icon: <SettingOutlined />, permission: 'config.settings.manage' },
    ],
  },
  {
    key: 'admin',
    title: '系统管理',
    desc: '用户账号与角色权限',
    permission: 'admin.users.manage',
    accent: '#dc2626',
    links: [
      { label: '用户管理', path: '/config/users', icon: <UsergroupAddOutlined />, permission: 'admin.users.manage' },
      { label: '角色权限', path: '/config/roles', icon: <SafetyOutlined />, permission: 'admin.roles.manage' },
    ],
  },
];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return '早上好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

function formatNumber(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return n.toLocaleString('zh-CN');
}

function formatOutput(n: number): string {
  if (!n) return '—';
  return `¥ ${formatNumber(Math.round(n))}`;
}

function StatCard({
  label,
  value,
  icon,
  accent,
  onClick,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: boolean;
  onClick?: () => void;
}) {
  return (
    <article
      className={`dash-stat${accent ? ' dash-stat-accent' : ''}${onClick ? ' dash-stat-clickable' : ''}`}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <span className="dash-stat-icon">{icon}</span>
      <div>
        <p className="dash-stat-label">{label}</p>
        <p className="dash-stat-value">{value}</p>
      </div>
    </article>
  );
}

function RecentQuotationRow({ item, onClick }: { item: Quotation; onClick: () => void }) {
  const status = QUOTATION_STATUS[item.status || 'draft'] || QUOTATION_STATUS.draft;
  return (
    <button type="button" className="dash-list-item" onClick={onClick}>
      <div className="dash-list-main">
        <span className="dash-list-title">{item.quotation_no || `#${item.id}`}</span>
        <span className="dash-list-sub">{item.brand_name || '未选品牌'}</span>
      </div>
      <div className="dash-list-meta">
        <Tag color={status.color}>{status.text}</Tag>
        <span className="dash-list-date">{item.quote_date || '—'}</span>
      </div>
    </button>
  );
}

function StyleAlertRow({ item, onClick }: { item: StyleRecord; onClick: () => void }) {
  return (
    <button type="button" className="dash-list-item" onClick={onClick}>
      <div className="dash-list-main">
        <span className="dash-list-title">{item.style_number || '—'}</span>
        <span className="dash-list-sub">{item.brand || '—'} · {item.style_name || '未命名'}</span>
      </div>
      <div className="dash-list-meta">
        <Tag color="orange">出货 {item.required_shipping_date || '—'}</Tag>
      </div>
    </button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { loading, stats, recentQuotations, offlineStyles, urgentStyles, monthlySummary } = useDashboardData();

  const visibleModules = useMemo(
    () =>
      MODULE_GROUPS.filter((group) => {
        if (group.key === 'config' || group.key === 'admin') {
          return group.links.some((l) => !l.permission || hasPermission(l.permission));
        }
        return hasPermission(group.permission) || group.links.some((l) => l.permission && hasPermission(l.permission));
      }).map((group) => ({
        ...group,
        links: group.links.filter((l) => !l.permission || hasPermission(l.permission)),
      })).filter((g) => g.links.length > 0),
    [hasPermission],
  );

  const primaryAction = useMemo(() => {
    if (hasPermission('quotations.create')) {
      return { label: '新建报价单', path: '/quotations/new', icon: <PlusOutlined /> };
    }
    if (hasPermission('menu.scheduling.view')) {
      return { label: '进入预警排单', path: '/scheduling', icon: <CalendarOutlined /> };
    }
    if (hasPermission('menu.quotations.view')) {
      return { label: '查看报价单', path: '/quotations', icon: <FileTextOutlined /> };
    }
    return null;
  }, [hasPermission]);

  const alerts = useMemo(() => {
    const items: Array<{ key: string; text: string; path: string; tone: 'warn' | 'info' }> = [];
    if (hasPermission('menu.quotations.view') && stats.drafts > 0) {
      items.push({
        key: 'drafts',
        text: `${stats.drafts} 份报价草稿待完善`,
        path: '/quotations?status=draft',
        tone: 'info',
      });
    }
    if (hasPermission('menu.scheduling.view') && stats.unscheduled > 0) {
      items.push({
        key: 'unscheduled',
        text: `${stats.unscheduled} 个款式尚未排单`,
        path: '/scheduling',
        tone: 'warn',
      });
    }
    if (hasPermission('menu.scheduling.view') && stats.offlinePending > 0) {
      items.push({
        key: 'offline',
        text: `${stats.offlinePending} 个款式待下线确认`,
        path: '/scheduling',
        tone: 'warn',
      });
    }
    return items;
  }, [hasPermission, stats]);

  const statCards = useMemo(() => {
    const cards: Array<{
      key: string;
      label: string;
      value: string | number;
      icon: React.ReactNode;
      accent?: boolean;
      path?: string;
    }> = [];

    if (hasPermission('menu.quotations.view')) {
      cards.push(
        { key: 'q-total', label: '报价单', value: stats.quotations, icon: <FileTextOutlined />, path: '/quotations' },
        { key: 'q-draft', label: '草稿', value: stats.drafts, icon: <ClockCircleOutlined />, accent: stats.drafts > 0, path: '/quotations' },
        { key: 'q-confirmed', label: '已确认', value: stats.confirmed, icon: <CheckCircleOutlined />, path: '/quotations' },
      );
    }
    if (hasPermission('menu.scheduling.view')) {
      cards.push(
        { key: 's-total', label: '预警款式', value: stats.styles, icon: <CalendarOutlined />, path: '/scheduling' },
        { key: 's-unsched', label: '待排单', value: stats.unscheduled, icon: <WarningOutlined />, accent: stats.unscheduled > 0, path: '/scheduling' },
        { key: 's-output', label: '本月销售产值', value: formatOutput(stats.currentMonthOutput), icon: <ExportOutlined />, path: '/scheduling' },
      );
    }
    if (hasPermission('config.brands.manage')) {
      cards.push({ key: 'brands', label: '品牌', value: stats.brands, icon: <TagOutlined />, path: '/config/brands' });
    }
    if (hasPermission('config.fabrics.manage')) {
      cards.push({ key: 'fabrics', label: '面料库', value: stats.fabrics, icon: <SkinOutlined />, path: '/config/fabrics' });
    }
    return cards;
  }, [hasPermission, stats]);

  const displayName = user?.displayName || user?.username || '同事';
  const roleLabels = (user?.roles || []).map((r) => ROLE_LABELS[r] || r);

  const topMonthly = monthlySummary.slice(0, 4);

  return (
    <div className="page-container dashboard-page">
      <section className="dash-hero">
        <div className="dash-hero-text">
          <p className="dash-hero-eyebrow">{APP_SYSTEM_NAME} · {APP_SUBTITLE}</p>
          <h1 className="dash-hero-title">{greeting()}，{displayName}</h1>
          <p className="dash-hero-desc">
            这里是您的工作概览。根据您的角色，下方展示可访问的模块、待办事项与关键数据。
          </p>
          {roleLabels.length > 0 && (
            <div className="dash-hero-roles">
              {roleLabels.map((label) => (
                <Tag key={label} className="dash-role-tag">{label}</Tag>
              ))}
            </div>
          )}
        </div>
        {primaryAction && (
          <Button
            type="primary"
            size="large"
            icon={primaryAction.icon}
            className="dash-hero-cta"
            onClick={() => navigate(primaryAction.path)}
          >
            {primaryAction.label}
          </Button>
        )}
      </section>

      {!loading && alerts.length > 0 && (
        <section className="dash-alerts">
          {alerts.map((alert) => (
            <button
              key={alert.key}
              type="button"
              className={`dash-alert dash-alert-${alert.tone}`}
              onClick={() => navigate(alert.path)}
            >
              <WarningOutlined />
              <span>{alert.text}</span>
              <ArrowRightOutlined className="dash-alert-arrow" />
            </button>
          ))}
        </section>
      )}

      <section className="dash-stats">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} active paragraph={false} className="dash-stat-skeleton" />
            ))
          : statCards.map((card) => (
              <StatCard
                key={card.key}
                label={card.label}
                value={card.value}
                icon={card.icon}
                accent={card.accent}
                onClick={card.path ? () => navigate(card.path!) : undefined}
              />
            ))}
      </section>

      <div className="dash-main-grid">
        <section className="card-panel dash-modules">
          <h3 className="section-title">模块入口</h3>
          <div className="dash-module-grid">
            {visibleModules.map((mod) => (
              <article key={mod.key} className="dash-module-card" style={{ '--module-accent': mod.accent } as React.CSSProperties}>
                <div className="dash-module-head">
                  <span className="dash-module-accent" />
                  <div>
                    <h4 className="dash-module-title">{mod.title}</h4>
                    <p className="dash-module-desc">{mod.desc}</p>
                  </div>
                </div>
                <div className="dash-module-links">
                  {mod.links.map((link) => (
                    <button
                      key={link.path}
                      type="button"
                      className={`dash-module-link${link.primary ? ' is-primary' : ''}`}
                      onClick={() => navigate(link.path)}
                    >
                      <span className="dash-module-link-icon">{link.icon}</span>
                      {link.label}
                    </button>
                  ))}
                </div>
              </article>
            ))}
            {!loading && visibleModules.length === 0 && (
              <Empty description="当前账号暂无可访问模块，请联系管理员分配权限" />
            )}
          </div>
        </section>

        <div className="dash-side-stack">
          {hasPermission('menu.quotations.view') && (
            <section className="card-panel">
              <div className="dash-panel-head">
                <h3 className="section-title">最近报价</h3>
                <Button type="link" size="small" onClick={() => navigate('/quotations')}>
                  查看全部
                </Button>
              </div>
              {loading ? (
                <Skeleton active paragraph={{ rows: 4 }} />
              ) : recentQuotations.length > 0 ? (
                <div className="dash-list">
                  {recentQuotations.map((q) => (
                    <RecentQuotationRow
                      key={q.id}
                      item={q}
                      onClick={() => navigate(`/quotations/${q.id}`)}
                    />
                  ))}
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无报价单" />
              )}
            </section>
          )}

          {hasPermission('menu.scheduling.view') && (
            <section className="card-panel">
              <div className="dash-panel-head">
                <h3 className="section-title">排单关注</h3>
                <Button type="link" size="small" onClick={() => navigate('/scheduling')}>
                  进入排单
                </Button>
              </div>
              {loading ? (
                <Skeleton active paragraph={{ rows: 4 }} />
              ) : offlineStyles.length > 0 || urgentStyles.length > 0 ? (
                <div className="dash-list">
                  {offlineStyles.map((s) => (
                    <button
                      key={`off-${s.id}`}
                      type="button"
                      className="dash-list-item"
                      onClick={() => navigate('/scheduling')}
                    >
                      <div className="dash-list-main">
                        <span className="dash-list-title">{s.style_number}</span>
                        <span className="dash-list-sub">待下线确认 · {s.group_name || '未分组'}</span>
                      </div>
                      <Tag color="red">下线</Tag>
                    </button>
                  ))}
                  {urgentStyles.map((s) => (
                    <StyleAlertRow
                      key={`urg-${s.id}`}
                      item={s}
                      onClick={() => navigate(`/scheduling/styles/${s.id}`)}
                    />
                  ))}
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待办排单事项" />
              )}
            </section>
          )}

          {hasPermission('menu.scheduling.view') && topMonthly.length > 0 && (
            <section className="card-panel">
              <h3 className="section-title">关账产值概览</h3>
              <div className="dash-monthly-grid">
                {topMonthly.map((m) => (
                  <div key={m.closing_month} className="dash-monthly-item">
                    <span className="dash-monthly-label">{m.closing_month}</span>
                    <span className="dash-monthly-value">{formatOutput(m.total_sales_output_value ?? 0)}</span>
                    <span className="dash-monthly-sub">{m.count ?? 0} 款</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
