import { useCallback, useEffect, useState } from 'react';
import {
  Drawer, Table, Button, Space, message, Modal, InputNumber,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { StyleRecord } from '@/types/style';
import {
  batchConfirmOffline,
  batchExtendWorkdays,
  getOfflineNotifications,
} from '@/api/styles';
import { formatDate } from '@/utils/styleCalculations';
import { groupLabel } from '@/utils/schedulingZone';

interface OfflineNotificationDrawerProps {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export default function OfflineNotificationDrawer({
  open,
  onClose,
  onChanged,
}: OfflineNotificationDrawerProps) {
  const [data, setData] = useState<StyleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [extendDays, setExtendDays] = useState<number | null>(3);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getOfflineNotifications();
      setData(res.data || []);
      setSelectedIds([]);
    } catch (err) {
      message.error(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const columns: ColumnsType<StyleRecord> = [
    { title: '款号', dataIndex: 'style_number', key: 'style_number', width: 110 },
    { title: '组别', key: 'group', width: 90, render: (_, r) => groupLabel(r) },
    { title: '下线时间', dataIndex: 'offline_time', key: 'offline_time', width: 110,
      render: (v) => formatDate(v) },
    { title: '所需天数', dataIndex: 'required_days', key: 'required_days', width: 90 },
  ];

  const handleConfirmOffline = async () => {
    if (selectedIds.length === 0) {
      message.warning('请先选择款式');
      return;
    }
    setSubmitting(true);
    try {
      await batchConfirmOffline(selectedIds);
      message.success(`已确认下线 ${selectedIds.length} 款`);
      await load();
      onChanged();
    } catch (err) {
      message.error(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleExtend = async () => {
    if (selectedIds.length === 0) {
      message.warning('请先选择款式');
      return;
    }
    const days = extendDays;
    if (days == null || !Number.isInteger(days) || days < 1) {
      message.warning('请输入正整数工作日');
      return;
    }
    setSubmitting(true);
    try {
      await batchExtendWorkdays(selectedIds.map((id) => ({ id, extra_workdays: days })));
      message.success(`已为 ${selectedIds.length} 款加 ${days} 个工作日，后续订单已顺延`);
      setExtendModalOpen(false);
      await load();
      onChanged();
    } catch (err) {
      message.error(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Drawer
        title="下线通知"
        open={open}
        onClose={onClose}
        width={720}
        extra={(
          <Space>
            <Button
              type="primary"
              loading={submitting}
              disabled={selectedIds.length === 0}
              onClick={handleConfirmOffline}
            >
              确认下线
            </Button>
            <Button
              loading={submitting}
              disabled={selectedIds.length === 0}
              onClick={() => setExtendModalOpen(true)}
            >
              订单加天
            </Button>
          </Space>
        )}
      >
        <p className="scheduling-toolbar-hint mb-3">
          生产组中下线日已过（早于今天）的款式会出现在此列表。
        </p>
        <Table
          rowKey="id"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={data}
          pagination={false}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys) => setSelectedIds(keys as number[]),
          }}
        />
      </Drawer>

      <Modal
        title="订单加天"
        open={extendModalOpen}
        onCancel={() => setExtendModalOpen(false)}
        onOk={handleExtend}
        confirmLoading={submitting}
      >
        <p className="mb-2">为所选款式增加还需的工作日，同组后续订单将自动顺延。</p>
        <InputNumber
          className="w-full"
          min={1}
          precision={0}
          value={extendDays}
          onChange={(v) => setExtendDays(v)}
          placeholder="还需工作日"
        />
      </Modal>
    </>
  );
}
