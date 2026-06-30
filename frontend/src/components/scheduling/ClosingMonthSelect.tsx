import type { ReactElement } from 'react';
import { Button, Select } from 'antd';
import type { SelectProps } from 'antd';
import {
  CLOSING_MONTH_SELECT_OPTIONS,
  closingMonthDropdownClassName,
  closingMonthYears,
  monthsOfYear,
  scrollClosingMonthToCenter,
} from '@/utils/closingMonthOptions';
import { defaultClosingMonth } from '@/utils/schedulingFilters';

type ClosingMonthSelectProps = SelectProps & {
  /** 打开下拉时滚动居中的月份，默认当月 */
  scrollToMonth?: string;
};

export default function ClosingMonthSelect({
  scrollToMonth,
  onOpenChange,
  popupClassName,
  listHeight = 280,
  mode,
  value,
  onChange,
  ...rest
}: ClosingMonthSelectProps) {
  const handleOpenChange = (open: boolean) => {
    if (open) {
      scrollClosingMonthToCenter(scrollToMonth || defaultClosingMonth());
    }
    onOpenChange?.(open);
  };

  const selectedMonths = mode === 'multiple'
    ? (Array.isArray(value) ? value : [])
    : (value ? [String(value)] : []);

  const toggleYear = (year: string) => {
    if (mode !== 'multiple' || !onChange) return;
    const yearMonths = monthsOfYear(year);
    const allSelected = yearMonths.every((m) => selectedMonths.includes(m));
    const next = allSelected
      ? selectedMonths.filter((m) => !yearMonths.includes(m))
      : [...new Set([...selectedMonths, ...yearMonths])];
    onChange(next, []);
  };

  const dropdownRender = mode === 'multiple'
    ? (menu: ReactElement) => (
      <div className="closing-month-select-dropdown-wrap">
        <div className="closing-month-year-bar">
          {closingMonthYears.map((year) => {
            const yearMonths = monthsOfYear(year);
            const allSelected = yearMonths.every((m) => selectedMonths.includes(m));
            return (
              <Button
                key={year}
                type={allSelected ? 'primary' : 'default'}
                size="small"
                onClick={() => toggleYear(year)}
              >
                {year}年
              </Button>
            );
          })}
        </div>
        {menu}
      </div>
    )
    : undefined;

  return (
    <Select
      mode={mode}
      value={value}
      onChange={onChange}
      options={CLOSING_MONTH_SELECT_OPTIONS}
      listHeight={listHeight}
      popupClassName={[closingMonthDropdownClassName(), popupClassName].filter(Boolean).join(' ')}
      onOpenChange={handleOpenChange}
      dropdownRender={dropdownRender}
      {...rest}
    />
  );
}
