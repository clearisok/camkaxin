import { Select } from 'antd';
import type { StyleRecord } from '@/types/style';
import { MOVE_TARGET_OPTIONS, moveTargetValue } from '@/utils/schedulingZone';

interface StyleMoveTargetCellProps {
  record: StyleRecord;
  savingId?: number | null;
  onMove: (id: number, target: string) => void;
}

export default function StyleMoveTargetCell({ record, savingId, onMove }: StyleMoveTargetCellProps) {
  return (
    <Select
      size="small"
      className="scheduling-inline-input w-full"
      value={moveTargetValue(record)}
      options={MOVE_TARGET_OPTIONS}
      loading={savingId === record.id}
      onChange={(target) => onMove(record.id, target)}
    />
  );
}
