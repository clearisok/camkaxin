import type { ColumnsType } from 'antd/es/table';
import type { Quotation } from '@/types';
import { Tag, Button, Space, Popconfirm, Image, Tooltip } from 'antd';
import {
  CopyOutlined, EditOutlined, DeleteOutlined, ExportOutlined, EyeOutlined,
} from '@ant-design/icons';
import {
  QUOTATION_LIST_COLUMN_DEFS,
  lockedColumnWidthStyle,
  resolveColumnWidth,
} from '@/utils/quotationListColumnPrefs';

const DEFAULT_WIDTHS = Object.fromEntries(
  QUOTATION_LIST_COLUMN_DEFS.map((c) => [c.key, c.defaultWidth])
) as Record<string, number>;

const statusMap: Record<string, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  sent: { color: 'processing', text: '已发送' },
  confirmed: { color: 'success', text: '已确认' },
  expired: { color: 'error', text: '已过期' },
};

function formatMoney(v: unknown): string {
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  return n.toFixed(2);
}

export interface QuotationListColumnHandlers {
  navigate: (path: string) => void;
  onCopy: (id: number) => void;
  onDelete: (id: number) => void;
  onExport: (id: number) => void;
}

function col(
  def: ColumnsType<Quotation>[number]
): ColumnsType<Quotation>[number] {
  return { align: 'center', ...def };
}

export function buildQuotationListColumns(handlers: QuotationListColumnHandlers): ColumnsType<Quotation> {
  const { navigate, onCopy, onDelete, onExport } = handlers;

  return [
    col({
      title: '款式图',
      dataIndex: 'list_style_image',
      key: 'list_style_image',
      width: DEFAULT_WIDTHS.list_style_image,
      render: (v: string, record: Quotation) => {
        const src = v || record.style_image;
        return (
          <div className="flex justify-center">
            {src ? (
              <Image src={`/${src}`} width={48} height={48} className="rounded object-contain bg-gray-50" />
            ) : (
              <span className="text-gray-300">—</span>
            )}
          </div>
        );
      },
    }),
    col({ title: '报价单号', dataIndex: 'quotation_no', key: 'quotation_no', width: DEFAULT_WIDTHS.quotation_no }),
    col({
      title: '款号', dataIndex: 'product_codes', key: 'product_codes', width: DEFAULT_WIDTHS.product_codes, ellipsis: true,
      render: (v: string) => v || '—',
    }),
    col({
      title: '数量', dataIndex: 'total_quantity', key: 'total_quantity', width: DEFAULT_WIDTHS.total_quantity,
      render: (v: number) => (v != null && Number(v) > 0 ? Number(v) : '—'),
    }),
    col({ title: '品牌', dataIndex: 'brand_name', key: 'brand_name', width: DEFAULT_WIDTHS.brand_name }),
    col({ title: '业务员', dataIndex: 'agent_name', key: 'agent_name', width: DEFAULT_WIDTHS.agent_name }),
    col({
      title: '报价日期', dataIndex: 'quote_date', key: 'quote_date', width: DEFAULT_WIDTHS.quote_date,
      render: (v: string) => (v ? String(v).slice(0, 10) : ''),
    }),
    col({ title: '币种', dataIndex: 'currency', key: 'currency', width: DEFAULT_WIDTHS.currency }),
    col({
      title: '面料价格', dataIndex: 'fabric_total', key: 'fabric_total', width: DEFAULT_WIDTHS.fabric_total,
      render: (v: number) => formatMoney(v),
    }),
    col({
      title: '辅料价格', dataIndex: 'accessory_total', key: 'accessory_total', width: DEFAULT_WIDTHS.accessory_total,
      render: (v: number) => formatMoney(v),
    }),
    col({
      title: '工价', dataIndex: 'labor_rmb', key: 'labor_rmb', width: DEFAULT_WIDTHS.labor_rmb,
      render: (v: number) => formatMoney(v),
    }),
    col({
      title: '状态', dataIndex: 'status', key: 'status', width: DEFAULT_WIDTHS.status,
      render: (s: string) => {
        const info = statusMap[s] || { color: 'default', text: s };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    }),
    col({
      title: '操作', key: 'action', width: DEFAULT_WIDTHS.action, fixed: 'right',
      render: (_: unknown, record: Quotation) => (
        <Space size={0} className="quotation-list-actions">
          <Tooltip title="查看">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/quotations/${record.id}`)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => navigate(`/quotations/${record.id}/edit`)} />
          </Tooltip>
          <Tooltip title="复制">
            <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => onCopy(record.id!)} />
          </Tooltip>
          <Tooltip title="导出">
            <Button type="link" size="small" icon={<ExportOutlined />} onClick={() => onExport(record.id!)} />
          </Tooltip>
          <Popconfirm title="确定删除？" onConfirm={() => onDelete(record.id!)}>
            <Tooltip title="删除">
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    }),
  ];
}

export interface ColumnResizeHandlers {
  onResize: (key: string, width: number) => void;
  onResizeStop: (key: string, width: number) => void;
}

function attachResizeHandler(
  col: ColumnsType<Quotation>[number],
  key: string,
  widths: Record<string, number>,
  handlers?: ColumnResizeHandlers
): ColumnsType<Quotation>[number] {
  const colWidth = resolveColumnWidth(key, col.width as number | undefined, widths);
  const locked = lockedColumnWidthStyle(colWidth);
  const next = {
    align: 'center' as const,
    ...col,
    ...locked,
    onCell: () => ({ style: { textAlign: 'center' as const, ...locked } }),
  };
  if (!handlers) return next;
  return {
    ...next,
    onHeaderCell: () => ({
      width: colWidth,
      style: locked,
      onResize: (w: number) => handlers.onResize(key, w),
      onResizeStop: (w: number) => handlers.onResizeStop(key, w),
    }),
  };
}

export function applyColumnPreferences(
  allColumns: ColumnsType<Quotation>,
  order: string[],
  visible: Record<string, boolean>,
  widths: Record<string, number>,
  resizeHandlers?: ColumnResizeHandlers
): ColumnsType<Quotation> {
  const map = new Map(allColumns.map((col) => [col.key as string, col]));
  const dataCols = order
    .filter((key) => key !== 'action' && visible[key] !== false && map.has(key))
    .map((key) => attachResizeHandler(map.get(key)!, key, widths, resizeHandlers));
  const actionCol = map.get('action');
  return actionCol
    ? [...dataCols, attachResizeHandler(actionCol, 'action', widths, resizeHandlers)]
    : dataCols;
}

export function estimateTableScrollX(columns: ColumnsType<Quotation>, selectionWidth = 48): number {
  return selectionWidth + columns.reduce((sum, col) => sum + (typeof col.width === 'number' ? col.width : 120), 0);
}
