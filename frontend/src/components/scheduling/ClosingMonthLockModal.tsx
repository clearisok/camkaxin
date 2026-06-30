import { Modal } from 'antd';
import type { ClosingMonthGroup } from '@/utils/closingMonthView';
import {
  formatSumProcessingOutputNumber,
  formatSumSalesOutputNumber,
} from '@/utils/earlyWarningExport';

interface ClosingMonthLockModalProps {
  open: boolean;
  group: ClosingMonthGroup | null;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ClosingMonthLockModal({
  open,
  group,
  loading,
  onConfirm,
  onCancel,
}: ClosingMonthLockModalProps) {
  const month = group?.month ?? '';
  return (
    <Modal
      title="关账锁定"
      open={open}
      onOk={onConfirm}
      onCancel={onCancel}
      confirmLoading={loading}
      okText="确定锁定"
      cancelText="取消"
      destroyOnClose
    >
      {group && (
        <div className="space-y-2 text-[15px] leading-relaxed">
          <p>
            是否确定要锁定 <strong>{month}</strong> 的关账？
          </p>
          <p>
            共 <strong>{group.rows.length}</strong> 款
          </p>
          <p>
            销售总产值：<strong>{formatSumSalesOutputNumber(group.totalSales)}</strong> 万元
          </p>
          <p>
            加工总产值：<strong>{formatSumProcessingOutputNumber(group.totalProcessing)}</strong> 万美金
          </p>
          <p className="text-gray-500 text-sm">锁定后该月将从主视图消失，可在「查看已关账」中查阅或恢复。</p>
        </div>
      )}
    </Modal>
  );
}
