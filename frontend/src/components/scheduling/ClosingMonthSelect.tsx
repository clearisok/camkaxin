import { Select } from 'antd';
import type { SelectProps } from 'antd';
import {
  CLOSING_MONTH_SELECT_OPTIONS,
  closingMonthDropdownClassName,
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
  ...rest
}: ClosingMonthSelectProps) {
  const handleOpenChange = (open: boolean) => {
    if (open) {
      scrollClosingMonthToCenter(scrollToMonth || defaultClosingMonth());
    }
    onOpenChange?.(open);
  };

  return (
    <Select
      options={CLOSING_MONTH_SELECT_OPTIONS}
      listHeight={listHeight}
      popupClassName={[closingMonthDropdownClassName(), popupClassName].filter(Boolean).join(' ')}
      onOpenChange={handleOpenChange}
      {...rest}
    />
  );
}
