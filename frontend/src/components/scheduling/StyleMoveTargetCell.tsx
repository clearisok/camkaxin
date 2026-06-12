import { Select } from 'antd';
import type { StyleRecord } from '@/types/style';
import { MOVE_TARGET_OPTIONS, moveTargetValue, patchForMoveTarget } from '@/utils/schedulingZone';

interface StyleMoveTargetCellProps {
  record: StyleRecord;
  savingId?: number | null;
  onMove: (id: number, patch: Record<string, unknown>) => void;
}

export default function StyleMoveTargetCell({ record, savingId, onMove }: StyleMoveTargetCellProps) {
  return (
    <Select
      size="small"
      className="scheduling-inline-input w-full"
      value={moveTargetValue(record)}
      options={MOVE_TARGET_OPTIONS}
      loading={savingId === record.id}
      onChange={(target) => onMove(record.id, patchForMoveTarget(target))}
    />
  );
}
