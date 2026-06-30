import { useCallback, useEffect, useMemo, useState } from 'react';
import { Drawer, Button, List, Modal, message, Segmented, Space, Tag } from 'antd';
import { UnlockOutlined } from '@ant-design/icons';
import type { ClosingMonthLock, StyleRecord } from '@/types/style';
import { getClosingLocks, getStyles, unlockClosingMonth } from '@/api/styles';
import ClosingMonthCardView from '@/components/scheduling/ClosingMonthCardView';
import ClosingMonthTableView from '@/components/scheduling/ClosingMonthTableView';
import { enrichStyleClient } from '@/utils/styleCalculations';
import { groupStylesByClosingMonth } from '@/utils/closingMonthView';
import {
  formatSumProcessingOutputNumber,
  formatSumSalesOutputNumber,
} from '@/utils/earlyWarningExport';

interface ClosedClosingArchiveDrawerProps {
  open: boolean;
  onClose: () => void;
  onUnlocked: () => void;
}

export default function ClosedClosingArchiveDrawer({
  open,
  onClose,
  onUnlocked,
}: ClosedClosingArchiveDrawerProps) {
  const [locks, setLocks] = useState<ClosingMonthLock[]>([]);
  const [loadingLocks, setLoadingLocks] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [detailRows, setDetailRows] = useState<StyleRecord[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [unlocking, setUnlocking] = useState(false);

  const loadLocks = useCallback(async () => {
    setLoadingLocks(true);
    try {
      const res = await getClosingLocks();
      setLocks(res.data || []);
    } catch (err) {
      message.error(String(err));
    } finally {
      setLoadingLocks(false);
    }
  }, []);

  const loadDetail = useCallback(async (month: string) => {
    setLoadingDetail(true);
    try {
      const res = await getStyles({
        view: 'closing',
        closing_month: month,
        locked_only: true,
      });
      setDetailRows((res.data || []).map(enrichStyleClient));
    } catch (err) {
      message.error(String(err));
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadLocks();
      setSelectedMonth(null);
      setDetailRows([]);
    }
  }, [open, loadLocks]);

  useEffect(() => {
    if (selectedMonth) void loadDetail(selectedMonth);
    else setDetailRows([]);
  }, [selectedMonth, loadDetail]);

  const detailGroups = useMemo(() => groupStylesByClosingMonth(detailRows), [detailRows]);

  const selectedLock = locks.find((l) => l.closing_month === selectedMonth);

  const handleUnlock = () => {
    if (!selectedMonth) return;
    Modal.confirm({
      title: '恢复关账',
      content: `确定恢复 ${selectedMonth} 的关账？恢复后可重新编辑该月款式。`,
      okText: '恢复',
      cancelText: '取消',
      onOk: async () => {
        setUnlocking(true);
        try {
          await unlockClosingMonth(selectedMonth);
          message.success(`${selectedMonth} 已恢复关账`);
          setSelectedMonth(null);
          await loadLocks();
          onUnlocked();
        } catch (err) {
          message.error(String(err));
        } finally {
          setUnlocking(false);
        }
      },
    });
  };

  return (
    <Drawer
      title="已关账月份"
      open={open}
      onClose={onClose}
      width={720}
      destroyOnClose
    >
      <List
        loading={loadingLocks}
        dataSource={locks}
        locale={{ emptyText: '暂无已关账月份' }}
        renderItem={(item) => (
          <List.Item
            className={`closing-archive-item${selectedMonth === item.closing_month ? ' is-active' : ''}`}
            onClick={() => setSelectedMonth(item.closing_month)}
          >
            <div className="w-full">
              <div className="flex justify-between items-center">
                <strong>{item.closing_month}</strong>
                <Tag>{item.style_count} 款</Tag>
              </div>
              <div className="text-sm text-gray-500 mt-1">
                销售 {formatSumSalesOutputNumber(item.total_sales_output_value)} 万元
                · 加工 {formatSumProcessingOutputNumber(item.total_processing_output_value)} 万美金
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {item.locked_by} · {String(item.locked_at).slice(0, 19).replace('T', ' ')}
              </div>
            </div>
          </List.Item>
        )}
      />

      {selectedMonth && selectedLock && (
        <div className="closing-archive-detail mt-4 pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
            <h4 className="text-base font-semibold m-0">{selectedMonth} 明细</h4>
            <Space>
              <Segmented
                size="small"
                value={viewMode}
                options={[
                  { label: '卡片', value: 'card' },
                  { label: '表格', value: 'table' },
                ]}
                onChange={(v) => setViewMode(v as 'card' | 'table')}
              />
              <Button
                size="small"
                icon={<UnlockOutlined />}
                loading={unlocking}
                onClick={handleUnlock}
              >
                恢复关账
              </Button>
            </Space>
          </div>
          {viewMode === 'card' ? (
            <ClosingMonthCardView groups={detailGroups} readOnly />
          ) : (
            <ClosingMonthTableView data={detailRows} loading={loadingDetail} readOnly />
          )}
        </div>
      )}
    </Drawer>
  );
}
