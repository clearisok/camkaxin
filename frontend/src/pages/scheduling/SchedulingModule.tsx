import { Tabs } from 'antd';
import PageHeader from '@/components/PageHeader';
import EarlyWarningView from './EarlyWarningView';
import SchedulingView from './SchedulingView';
import ClosingMonthView from './ClosingMonthView';

export default function SchedulingModule() {
  return (
    <div className="page-container">
      <PageHeader title="预警排单" subtitle="Early Warning & Scheduling" />
      <Tabs
        defaultActiveKey="early_warning"
        items={[
          { key: 'early_warning', label: '预警视图', children: <EarlyWarningView /> },
          { key: 'scheduling', label: '排单视图', children: <SchedulingView /> },
          { key: 'closing', label: '关账视图', children: <ClosingMonthView /> },
        ]}
      />
    </div>
  );
}
