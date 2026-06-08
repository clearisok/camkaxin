import { useSearchParams } from 'react-router-dom';
import EarlyWarningView from './EarlyWarningView';
import SchedulingView from './SchedulingView';
import ClosingMonthView from './ClosingMonthView';
import { getSchedulingTab } from '@/components/SchedulingHeaderTabs';

export default function SchedulingModule() {
  const [searchParams] = useSearchParams();
  const tab = getSchedulingTab(`?${searchParams.toString()}`);

  return (
    <div className="page-container scheduling-module-content">
      {tab === 'early_warning' && <EarlyWarningView />}
      {tab === 'scheduling' && <SchedulingView />}
      {tab === 'closing' && <ClosingMonthView />}
    </div>
  );
}
