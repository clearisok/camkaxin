import { CLOSING_MONTH_OPTIONS } from '@/types/style';
import { defaultClosingMonth } from '@/utils/schedulingFilters';

/** 关账月份选项：保持时间顺序 */
export const CLOSING_MONTH_SELECT_OPTIONS = CLOSING_MONTH_OPTIONS.map((m) => ({
  value: m,
  label: m,
}));

const DROPDOWN_CLASS = 'closing-month-select-dropdown';
const OPTION_HEIGHT = 32;

export function closingMonthDropdownClassName() {
  return DROPDOWN_CLASS;
}

/** 打开下拉时，将指定月份滚动到列表可视区域中间（不改变选项顺序） */
export function scrollClosingMonthToCenter(month?: string) {
  const target = month && CLOSING_MONTH_OPTIONS.includes(month) ? month : defaultClosingMonth();
  const index = CLOSING_MONTH_OPTIONS.indexOf(target);
  if (index < 0) return;

  window.setTimeout(() => {
    const dropdowns = document.querySelectorAll(`.${DROPDOWN_CLASS}`);
    const dropdown = dropdowns[dropdowns.length - 1];
    if (!dropdown) return;

    const holder = dropdown.querySelector('.rc-virtual-list-holder') as HTMLElement | null;
    if (!holder) return;

    const visibleCount = Math.max(1, Math.floor(holder.clientHeight / OPTION_HEIGHT));
    const centerOffset = Math.floor(visibleCount / 2);
    const scrollIndex = Math.max(0, Math.min(index - centerOffset, CLOSING_MONTH_OPTIONS.length - visibleCount));
    holder.scrollTop = scrollIndex * OPTION_HEIGHT;

    const items = holder.querySelectorAll('.ant-select-item-option');
    for (const item of items) {
      const label = item.getAttribute('title') || item.textContent?.trim();
      if (label === target) {
        item.scrollIntoView({ block: 'center' });
        break;
      }
    }
  }, 0);
}
