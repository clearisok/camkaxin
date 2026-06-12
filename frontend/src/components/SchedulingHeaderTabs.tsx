import { useNavigate, useSearchParams } from 'react-router-dom';

const TAB_ITEMS = [
  { key: 'early_warning', label: '预警视图', hint: '未排单与交期预警' },
  { key: 'scheduling', label: '排单视图', hint: '按组别排产' },
  { key: 'closing', label: '关账视图', hint: '月度产值汇总' },
];

export const SCHEDULING_TAB_DEFAULT = 'early_warning';

export function getSchedulingTab(search: string): string {
  const tab = new URLSearchParams(search).get('tab');
  return TAB_ITEMS.some((item) => item.key === tab) ? tab! : SCHEDULING_TAB_DEFAULT;
}

export default function SchedulingHeaderTabs() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeKey = getSchedulingTab(`?${searchParams.toString()}`);

  return (
    <nav className="view-switcher" aria-label="预警排单视图切换">
      {TAB_ITEMS.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`view-switcher-item${activeKey === item.key ? ' is-active' : ''}`}
          title={item.hint}
          onClick={() => navigate(`/scheduling?tab=${item.key}`)}
        >
          <span className="view-switcher-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
