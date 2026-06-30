import FilterField from '@/components/FilterField';
import ClosingMonthSelect from '@/components/scheduling/ClosingMonthSelect';
import type { ClosingMonthRange } from '@/utils/closingMonthRange';

interface ClosingMonthRangeFilterProps {
  value: ClosingMonthRange;
  onChange: (range: ClosingMonthRange) => void;
  disabled?: boolean;
}

export default function ClosingMonthRangeFilter({
  value,
  onChange,
  disabled,
}: ClosingMonthRangeFilterProps) {
  return (
    <div className="closing-month-range-filter">
      <FilterField label="关账开始月">
        <ClosingMonthSelect
          style={{ minWidth: 120 }}
          value={value.startMonth}
          scrollToMonth={value.startMonth}
          disabled={disabled}
          onChange={(v) => onChange({ ...value, startMonth: String(v) })}
        />
      </FilterField>
      <FilterField label="关账结束月">
        <ClosingMonthSelect
          style={{ minWidth: 120 }}
          value={value.endMonth}
          scrollToMonth={value.endMonth}
          disabled={disabled}
          onChange={(v) => onChange({ ...value, endMonth: String(v) })}
        />
      </FilterField>
    </div>
  );
}
