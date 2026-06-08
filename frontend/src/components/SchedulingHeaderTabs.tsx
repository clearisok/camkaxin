import { Tabs } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';

const TAB_ITEMS = [
  { key: 'early_warning', label: '预警视图' },
  { key: 'scheduling', label: '排单视图' },
  { key: 'closing', label: '关账视图' },
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
    <Tabs
      className="app-header-scheduling-tabs"
      activeKey={activeKey}
      items={TAB_ITEMS}
      onChange={(key) => navigate(`/scheduling?tab=${key}`)}
    />
  );
}
