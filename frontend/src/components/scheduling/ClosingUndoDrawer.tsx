import { useMemo, useState } from 'react';
import { Button, Checkbox, Drawer, Empty, Space, message } from 'antd';
import type { ClosingEditStep } from '@/utils/closingEditSteps';

interface ClosingUndoDrawerProps {
  open: boolean;
  steps: ClosingEditStep[];
  onClose: () => void;
  onUndo: (stepIds: string[]) => void;
}

export default function ClosingUndoDrawer({
  open,
  steps,
  onClose,
  onUndo,
}: ClosingUndoDrawerProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const activeSteps = useMemo(() => steps.filter((s) => !s.undone), [steps]);

  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  const handleUndo = () => {
    if (selected.length === 0) {
      message.warning('请先勾选要撤销的步骤');
      return;
    }
    onUndo(selected);
    setSelected([]);
  };

  return (
    <Drawer
      title="撤销变更"
      open={open}
      onClose={onClose}
      width={480}
      destroyOnClose
      footer={(
        <Space>
          <Button onClick={() => setSelected(activeSteps.map((s) => s.id))}>全选</Button>
          <Button onClick={() => setSelected([])}>清空</Button>
          <Button type="primary" disabled={selected.length === 0} onClick={handleUndo}>
            撤销选中 ({selected.length})
          </Button>
        </Space>
      )}
    >
      {activeSteps.length === 0 ? (
        <Empty description="本次暂无待撤销的操作" />
      ) : (
        <div className="closing-undo-steps">
          {[...activeSteps].reverse().map((step) => (
            <div key={step.id} className="closing-undo-step">
              <Checkbox
                checked={selected.includes(step.id)}
                onChange={(e) => toggle(step.id, e.target.checked)}
              >
                <div className="closing-undo-step-body">
                  <div className="closing-undo-step-title">{step.styleNumber}</div>
                  <div className="closing-undo-step-desc">{step.label}</div>
                  <div className="closing-undo-step-time text-xs text-gray-400">
                    {new Date(step.timestamp).toLocaleString('zh-CN')}
                  </div>
                </div>
              </Checkbox>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
