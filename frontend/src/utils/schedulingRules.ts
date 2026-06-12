import type { StyleRecord } from '@/types/style';
import { inferZone } from '@/utils/schedulingZone';

/** 待排母单：wait 区 + 无父单 + 仍有未排数量（与预警标黄、排单待排区一致） */
export function isAwaitingSchedule(row: StyleRecord): boolean {
  if (row.parent_style_id != null) return false;
  if (inferZone(row) !== 'wait') return false;
  return (row.unscheduled_quantity ?? 0) > 0;
}
