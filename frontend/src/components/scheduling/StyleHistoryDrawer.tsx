import { useEffect, useState } from 'react';
import { Drawer, Timeline, Spin, Empty } from 'antd';
import { getStyleHistory } from '@/api/styles';
import type { StyleHistoryRecord } from '@/types/style';
import { STYLE_FIELD_LABELS } from '@/types/style';

interface StyleHistoryDrawerProps {
  styleId: number | null;
  styleLabel?: string;
  open: boolean;
  onClose: () => void;
}

function formatValue(key: string, value: unknown): string {
  if (value == null || value === '') return '—';
  if (key === 'is_outsourced') return value ? '是' : '否';
  if (typeof value === 'string' && value.includes('T')) return value.slice(0, 10);
  return String(value);
}

export default function StyleHistoryDrawer({ styleId, styleLabel, open, onClose }: StyleHistoryDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<StyleHistoryRecord[]>([]);

  useEffect(() => {
    if (!open || !styleId) return;
    setLoading(true);
    getStyleHistory(styleId)
      .then((res) => setRecords(res.data || []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [open, styleId]);

  return (
    <Drawer
      title={`变更历史${styleLabel ? ` · ${styleLabel}` : ''}`}
      open={open}
      onClose={onClose}
      width={480}
    >
      {loading ? (
        <div className="flex justify-center py-12"><Spin /></div>
      ) : records.length === 0 ? (
        <Empty description="暂无变更记录" />
      ) : (
        <Timeline
          items={records.map((rec) => ({
            children: (
              <div className="text-sm">
                <div className="text-gray-400 mb-1">
                  {new Date(rec.changed_at).toLocaleString('zh-CN')} · {rec.changed_by}
                </div>
                <ul className="space-y-1">
                  {Object.entries(rec.changed_data || {}).map(([key, change]) => (
                    <li key={key}>
                      <span className="text-gray-600">{STYLE_FIELD_LABELS[key] || key}：</span>
                      <span className="text-red-500 line-through mr-1">{formatValue(key, change.old)}</span>
                      <span className="text-green-600">{formatValue(key, change.new)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ),
          }))}
        />
      )}
    </Drawer>
  );
}
