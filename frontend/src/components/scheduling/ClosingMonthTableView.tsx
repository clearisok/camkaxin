import { useMemo } from 'react';
import { Button, InputNumber, Select, Table, Tag } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { StyleRecord } from '@/types/style';
import { CLOSING_MONTH_OPTIONS } from '@/types/style';
import ReadOnlyCell from '@/components/scheduling/ReadOnlyCell';
import StyleImageCell from '@/components/scheduling/StyleImageCell';
import ResizableTableHeader from '@/components/ResizableTableHeader';
import {
  CLOSING_ORDER_STATUS_COLORS,
  CLOSING_ORDER_STATUS_LABELS,
  getClosingOrderStatus,
} from '@/utils/closingMonthView';
import { formatOutputValueNumber } from '@/utils/earlyWarningExport';
import { formatDate } from '@/utils/styleCalculations';
import { formatMaterialText, groupLabel } from '@/utils/schedulingZone';
import type { ColumnPreferences } from '@/utils/quotationListColumnPrefs';
import {
  CLOSING_COLUMNS,
  CLOSING_STORAGE_KEY,
  loadViewColumnPreferences,
} from '@/utils/schedulingColumnPrefs';
import {
  applyViewColumnPreferences,
  estimateScrollX,
  type ColumnResizeHandlers,
} from '@/utils/viewColumnUtils';

export interface DraftStyle extends StyleRecord {
  _dirty?: boolean;
}

interface ClosingMonthTableViewProps {
  data: DraftStyle[];
  loading?: boolean;
  readOnly?: boolean;
  monthOptions?: string[];
  selectedRowKeys?: number[];
  onSelectionChange?: (keys: number[]) => void;
  columnPrefs?: ColumnPreferences;
  resizeHandlers?: ColumnResizeHandlers;
  onUpdate?: (id: number, patch: Partial<DraftStyle>) => void;
  onHistory?: (record: StyleRecord) => void;
}

const TABLE_HEADER_COMPONENTS = { header: { cell: ResizableTableHeader } };

export default function ClosingMonthTableView({
  data,
  loading,
  readOnly,
  monthOptions,
  selectedRowKeys,
  onSelectionChange,
  columnPrefs: columnPrefsProp,
  resizeHandlers,
  onUpdate,
  onHistory,
}: ClosingMonthTableViewProps) {
  const months = monthOptions ?? [...CLOSING_MONTH_OPTIONS];
  const selectable = !readOnly && !!onSelectionChange;
  const columnPrefs = columnPrefsProp ?? loadViewColumnPreferences(CLOSING_STORAGE_KEY, CLOSING_COLUMNS);

  const allColumns: ColumnsType<DraftStyle> = useMemo(() => [
    {
      title: '款号', dataIndex: 'style_number', key: 'style_number', width: 110, fixed: 'left',
      render: (v: string) => <ReadOnlyCell value={v} />,
    },
    {
      title: '品牌', dataIndex: 'brand', key: 'brand', width: 100,
      render: (v: string) => <ReadOnlyCell value={v} />,
    },
    {
      title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80,
      render: (v: number) => <ReadOnlyCell value={v} />,
    },
    {
      title: '款式名称', dataIndex: 'style_name', key: 'style_name', width: 120,
      render: (v: string) => <ReadOnlyCell value={v} />,
    },
    {
      title: '业务员', dataIndex: 'salesperson', key: 'salesperson', width: 96,
      render: (v: string) => <ReadOnlyCell value={v} />,
    },
    {
      title: 'PO号', dataIndex: 'po_number', key: 'po_number', width: 110,
      render: (v: string) => <ReadOnlyCell value={v} />,
    },
    {
      title: '要求出货日', dataIndex: 'required_shipping_date', key: 'required_shipping_date', width: 120,
      render: (v: string) => <ReadOnlyCell value={formatDate(v)} placeholder="—" />,
    },
    {
      title: '关账月份', dataIndex: 'closing_month', key: 'closing_month', width: 130,
      render: (v: string, record) => readOnly || !onUpdate ? (
        <ReadOnlyCell value={v} placeholder="—" />
      ) : (
        <Select
          size="small"
          className="w-full"
          value={v}
          options={months.map((m) => ({ value: m, label: m }))}
          onChange={(val) => onUpdate(record.id, { closing_month: val })}
        />
      ),
    },
    {
      title: '订单状态', key: 'order_status', width: 96,
      render: (_: unknown, record) => {
        const status = getClosingOrderStatus(record);
        return (
          <Tag color={CLOSING_ORDER_STATUS_COLORS[status]}>
            {CLOSING_ORDER_STATUS_LABELS[status]}
          </Tag>
        );
      },
    },
    {
      title: '备注', dataIndex: 'remarks', key: 'remarks', width: 160,
      render: (v: string) => <ReadOnlyCell value={v} multiline />,
    },
    {
      title: '款式图', dataIndex: 'style_image', key: 'style_image', width: 72,
      render: (v: string) => <StyleImageCell src={v} />,
    },
    {
      title: '面辅料', dataIndex: 'fabric_readiness', key: 'fabric_readiness', width: 200,
      render: (_: unknown, record: StyleRecord) => (
        <ReadOnlyCell
          value={formatMaterialText(record.fabric_readiness, record.accessories_readiness)}
          multiline
        />
      ),
    },
    {
      title: '面料结构', dataIndex: 'fabric_structure', key: 'fabric_structure', width: 110,
      render: (v: string) => <ReadOnlyCell value={v} />,
    },
    {
      title: '样衣进度', dataIndex: 'sample_progress', key: 'sample_progress', width: 110,
      render: (v: string) => <ReadOnlyCell value={v} />,
    },
    {
      title: '印绣花', dataIndex: 'printing_embroidery', key: 'printing_embroidery', width: 100,
      render: (v: string) => <ReadOnlyCell value={v} />,
    },
    {
      title: '跟单员', dataIndex: 'order_follower', key: 'order_follower', width: 96,
      render: (v: string) => <ReadOnlyCell value={v} />,
    },
    {
      title: '加工单价', dataIndex: 'processing_unit_price', key: 'processing_unit_price', width: 100,
      render: (v: number, record) => readOnly || !onUpdate ? (
        <ReadOnlyCell value={v} />
      ) : (
        <InputNumber
          size="small"
          className="scheduling-inline-input w-full"
          value={v}
          min={0}
          step={0.01}
          precision={2}
          onChange={(val) => onUpdate(record.id, { processing_unit_price: val ?? undefined })}
        />
      ),
    },
    {
      title: '加工产值（万美金）', dataIndex: 'processing_output_value', key: 'processing_output_value', width: 120,
      render: (v: number) => <ReadOnlyCell value={formatOutputValueNumber(v)} />,
    },
    {
      title: '销售单价', dataIndex: 'sales_price', key: 'sales_price', width: 100,
      render: (v: number) => <ReadOnlyCell value={v} />,
    },
    {
      title: '销售产值（万元）', dataIndex: 'sales_output_value', key: 'sales_output_value', width: 120,
      render: (v: number) => <ReadOnlyCell value={formatOutputValueNumber(v)} />,
    },
    {
      title: '所需天数', dataIndex: 'required_days', key: 'required_days', width: 80,
      render: (v: number | null) => <ReadOnlyCell value={v ?? undefined} />,
    },
    {
      title: '是否外发', dataIndex: 'is_outsourced', key: 'is_outsourced', width: 80,
      render: (v: boolean) => <ReadOnlyCell value={v ? '是' : '否'} />,
    },
    {
      title: '排入组别', dataIndex: 'group_name', key: 'group_name', width: 90,
      render: (_: unknown, record: StyleRecord) => <ReadOnlyCell value={groupLabel(record)} />,
    },
    {
      title: '外发工厂', dataIndex: 'outsourced_factory', key: 'outsourced_factory', width: 120,
      render: (v: string) => <ReadOnlyCell value={v} />,
    },
    {
      title: '外发单价', dataIndex: 'outsourced_price', key: 'outsourced_price', width: 90,
      render: (v: number) => <ReadOnlyCell value={v} />,
    },
    {
      title: '上线时间', dataIndex: 'online_time', key: 'online_time', width: 110,
      render: (v: string) => <ReadOnlyCell value={formatDate(v)} placeholder="—" />,
    },
    {
      title: '下线时间', dataIndex: 'offline_time', key: 'offline_time', width: 110,
      render: (v: string) => <ReadOnlyCell value={formatDate(v)} placeholder="—" />,
    },
    {
      title: '操作', key: 'action', width: 80, fixed: 'right',
      render: (_: unknown, record: StyleRecord) => (
        <Button type="link" size="small" icon={<HistoryOutlined />} onClick={() => onHistory?.(record)} />
      ),
    },
  ], [readOnly, onUpdate, onHistory, months]);

  const columns = useMemo(
    () => applyViewColumnPreferences(allColumns, columnPrefs, {
      resizeHandlers,
      cellAlign: 'left',
    }),
    [allColumns, columnPrefs, resizeHandlers],
  );

  const scrollX = useMemo(() => estimateScrollX(columns as ColumnsType<unknown>), [columns]);

  return (
    <Table
      className="quotation-list-table"
      rowKey="id"
      columns={columns}
      dataSource={data}
      loading={loading}
      scroll={{ x: scrollX }}
      pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
      rowClassName={(record) => (record._dirty ? 'row-dirty' : '')}
      components={resizeHandlers ? TABLE_HEADER_COMPONENTS : undefined}
      rowSelection={selectable ? {
        selectedRowKeys,
        onChange: (keys) => onSelectionChange?.(keys as number[]),
      } : undefined}
    />
  );
}
