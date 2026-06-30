import { Button, Tag } from 'antd';
import { HistoryOutlined, LockOutlined } from '@ant-design/icons';
import type { StyleRecord } from '@/types/style';
import StyleImageCell from '@/components/scheduling/StyleImageCell';
import type { ClosingMonthGroup } from '@/utils/closingMonthView';
import {
  CLOSING_ORDER_STATUS_COLORS,
  CLOSING_ORDER_STATUS_LABELS,
  getClosingOrderStatus,
} from '@/utils/closingMonthView';
import {
  formatSumProcessingOutputNumber,
  formatSumSalesOutputNumber,
  formatOutputValueNumber,
} from '@/utils/earlyWarningExport';

interface ClosingMonthCardViewProps {
  groups: ClosingMonthGroup[];
  readOnly?: boolean;
  onLockMonth?: (group: ClosingMonthGroup) => void;
  onHistory?: (record: StyleRecord) => void;
}

function StyleCard({
  record,
  readOnly,
  onHistory,
}: {
  record: StyleRecord;
  readOnly?: boolean;
  onHistory?: (record: StyleRecord) => void;
}) {
  const status = getClosingOrderStatus(record);
  return (
    <div className="closing-style-card">
      <div className="closing-style-card-head">
        <StyleImageCell src={record.style_image} size={48} />
        <div className="closing-style-card-meta">
          <div className="closing-style-card-number">{record.style_number || '—'}</div>
          <div className="closing-style-card-sub">{record.brand || '—'} · {record.style_name || '—'}</div>
        </div>
        <Tag color={CLOSING_ORDER_STATUS_COLORS[status]} className="!m-0">
          {CLOSING_ORDER_STATUS_LABELS[status]}
        </Tag>
      </div>
      <div className="closing-style-card-stats">
        <span>销售 {formatOutputValueNumber(record.sales_output_value)} 万</span>
        <span>加工 {formatOutputValueNumber(record.processing_output_value)} 万</span>
        <span>数量 {record.quantity ?? '—'}</span>
      </div>
      {onHistory && (
        <Button
          type="link"
          size="small"
          className="!px-0 closing-style-card-history"
          icon={<HistoryOutlined />}
          onClick={() => onHistory(record)}
        >
          历史
        </Button>
      )}
    </div>
  );
}

export default function ClosingMonthCardView({
  groups,
  readOnly,
  onLockMonth,
  onHistory,
}: ClosingMonthCardViewProps) {
  if (groups.length === 0) {
    return <div className="closing-empty-hint">暂无款式数据</div>;
  }

  return (
    <div className="closing-month-card-groups">
      {groups.map((group) => (
        <section key={group.month} className="closing-month-group">
          <div className="closing-month-group-header">
            <div>
              <h4 className="closing-month-group-title">{group.month}</h4>
              <p className="closing-month-group-summary">
                {group.rows.length} 款 · 销售 {formatSumSalesOutputNumber(group.totalSales)} 万元
                · 加工 {formatSumProcessingOutputNumber(group.totalProcessing)} 万美金
              </p>
            </div>
            {!readOnly && group.month !== '未分配' && onLockMonth && (
              <Button
                type="primary"
                size="small"
                icon={<LockOutlined />}
                onClick={() => onLockMonth(group)}
              >
                关账锁定
              </Button>
            )}
          </div>
          <div className="closing-style-card-grid">
            {group.rows.map((row) => (
              <StyleCard key={row.id} record={row} readOnly={readOnly} onHistory={onHistory} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
