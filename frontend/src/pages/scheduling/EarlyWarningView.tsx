import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Switch, Input, Select, Space, Button, message } from 'antd';
import { HistoryOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType, TableProps } from 'antd/es/table';
import type { SorterResult } from 'antd/es/table/interface';
import TableColumnSettings from '@/components/TableColumnSettings';
import ResizableTableHeader from '@/components/ResizableTableHeader';
import StyleHistoryDrawer from '@/components/scheduling/StyleHistoryDrawer';
import StyleImageCell from '@/components/scheduling/StyleImageCell';
import {
  StyleNumberCell,
  StyleDateCell,
  StyleTextCell,
  StyleTextAreaCell,
  StyleClosingMonthCell,
  StyleBrandCell,
  StyleSalespersonCell,
} from '@/components/scheduling/StyleInlineCells';
import { useStyleInlineEdit } from '@/hooks/useStyleInlineEdit';
import { getStyles } from '@/api/styles';
import { getBrands } from '@/api';
import type { Brand } from '@/types';
import type { StyleRecord } from '@/types/style';
import { CLOSING_MONTH_OPTIONS } from '@/types/style';
import { enrichStyleClient, formatMoney, isUnscheduled } from '@/utils/styleCalculations';
import {
  EARLY_WARNING_COLUMNS,
  EARLY_WARNING_DEFAULT_WIDTHS,
  EARLY_WARNING_STORAGE_KEY,
  loadViewColumnPreferences,
  normalizeViewColumnPreferences,
  saveViewColumnPreferences,
} from '@/utils/schedulingColumnPrefs';
import type { ColumnPreferences } from '@/utils/quotationListColumnPrefs';
import {
  applyViewColumnPreferences,
  createColumnResizeHandlers,
  estimateScrollX,
} from '@/utils/viewColumnUtils';

const EARLY_WARNING_SORT_STORAGE_KEY = 'scheduling-early-warning-sort';
const TABLE_HEADER_COMPONENTS = { header: { cell: ResizableTableHeader } };

const SORTABLE_COLUMN_KEYS = new Set([
  'style_number', 'brand', 'quantity', 'style_name', 'salesperson', 'po_number',
  'closing_month', 'required_shipping_date', 'processing_unit_price', 'sales_price',
  'processing_output_value', 'sales_output_value',
]);

interface SortState {
  field?: string;
  order?: 'asc' | 'desc';
}

function loadSortState(): SortState {
  try {
    const raw = localStorage.getItem(EARLY_WARNING_SORT_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as SortState;
  } catch {
    return {};
  }
}

function saveSortState(state: SortState) {
  localStorage.setItem(EARLY_WARNING_SORT_STORAGE_KEY, JSON.stringify(state));
}

function withServerSort<T extends { key?: string }>(
  col: T,
  sortState: SortState,
): T & { sorter?: boolean; sortOrder?: 'ascend' | 'descend' | null; sortDirections?: ('ascend' | 'descend')[] } {
  const key = col.key as string;
  if (!key || !SORTABLE_COLUMN_KEYS.has(key)) return col;
  return {
    ...col,
    sorter: true,
    sortDirections: ['ascend', 'descend'],
    sortOrder: sortState.field === key
      ? (sortState.order === 'desc' ? 'descend' : sortState.order === 'asc' ? 'ascend' : null)
      : null,
  };
}

export default function EarlyWarningView() {
  const navigate = useNavigate();
  const [data, setData] = useState<StyleRecord[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState<string | undefined>();
  const [salespersonFilter, setSalespersonFilter] = useState<string | undefined>();
  const [closingMonthFilter, setClosingMonthFilter] = useState<string | undefined>();
  const [unscheduledOnly, setUnscheduledOnly] = useState(false);
  const [sortState, setSortState] = useState<SortState>(loadSortState);
  const [columnPrefs, setColumnPrefs] = useState<ColumnPreferences>(() =>
    loadViewColumnPreferences(EARLY_WARNING_STORAGE_KEY, EARLY_WARNING_COLUMNS)
  );
  const [historyStyle, setHistoryStyle] = useState<StyleRecord | null>(null);
  const { savingId, updateLocal, saveField } = useStyleInlineEdit(setData);

  const cellProps = (record: StyleRecord) => ({ record, updateLocal, saveField, savingId });
  const brandProps = (record: StyleRecord) => ({ ...cellProps(record), brands });

  const persistColumnPrefs = useCallback((prefs: ColumnPreferences) => {
    saveViewColumnPreferences(EARLY_WARNING_STORAGE_KEY, prefs, EARLY_WARNING_COLUMNS);
  }, []);

  const normalizePrefs = useCallback(
    (raw: Partial<ColumnPreferences> | null) => normalizeViewColumnPreferences(raw, EARLY_WARNING_COLUMNS),
    [],
  );

  const { onResize, onResizeStop } = useMemo(
    () => createColumnResizeHandlers(EARLY_WARNING_DEFAULT_WIDTHS, setColumnPrefs, normalizePrefs, persistColumnPrefs),
    [normalizePrefs, persistColumnPrefs],
  );

  useEffect(() => {
    getBrands()
      .then((res) => setBrands(res.data || []))
      .catch((err) => message.error(String(err)));
  }, []);

  const salespersonFilterOptions = useMemo(() => {
    const brand = brandFilter ? brands.find((b) => b.name === brandFilter) : undefined;
    const agents = brand?.agents || [];
    const source = brandFilter && agents.length > 0
      ? agents
      : brands.flatMap((b) => b.agents || []);
    const names = [...new Set(source.map((a) => a.name).filter(Boolean))];
    return names.sort((a, b) => a.localeCompare(b, 'zh-CN')).map((name) => ({ value: name, label: name }));
  }, [brands, brandFilter]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getStyles({
        view: 'early_warning',
        unscheduled_only: unscheduledOnly,
        search: search || undefined,
        brand: brandFilter,
        salesperson: salespersonFilter,
        closing_month: closingMonthFilter,
        sort_by: sortState.field,
        sort_order: sortState.order,
      });
      setData((res.data || []).map(enrichStyleClient));
    } catch (err) {
      message.error(String(err));
    } finally {
      setLoading(false);
    }
  }, [unscheduledOnly, search, brandFilter, salespersonFilter, closingMonthFilter, sortState]);

  useEffect(() => { loadData(); }, [loadData]);

  const resetFilters = () => {
    setSearch('');
    setBrandFilter(undefined);
    setSalespersonFilter(undefined);
    setClosingMonthFilter(undefined);
    setUnscheduledOnly(false);
    const defaultSort: SortState = {};
    setSortState(defaultSort);
    saveSortState(defaultSort);
  };

  const handleTableChange: TableProps<StyleRecord>['onChange'] = (_pagination, _filters, sorter) => {
    const item = (Array.isArray(sorter) ? sorter[0] : sorter) as SorterResult<StyleRecord>;
    const field = item?.columnKey as string | undefined;
    const order = item?.order === 'descend' ? 'desc' : item?.order === 'ascend' ? 'asc' : undefined;
    const next: SortState = field && order ? { field, order } : {};
    setSortState(next);
    saveSortState(next);
  };

  const allColumns: ColumnsType<StyleRecord> = useMemo(() => [
    withServerSort({
      title: '款号', dataIndex: 'style_number', key: 'style_number', width: 110,
      render: (v: string, record: StyleRecord) => (
        <Button
          type="link"
          size="small"
          className="!px-0 font-medium"
          onClick={() => navigate(`/scheduling/styles/${record.id}`)}
        >
          {v || '—'}
        </Button>
      ),
    }, sortState),
    withServerSort({
      title: '品牌', dataIndex: 'brand', key: 'brand', width: 100,
      render: (_: unknown, record) => <StyleBrandCell {...brandProps(record)} />,
    }, sortState),
    withServerSort({
      title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80,
      render: (_: unknown, record) => <StyleNumberCell field="quantity" {...cellProps(record)} />,
    }, sortState),
    withServerSort({
      title: '款式名称', dataIndex: 'style_name', key: 'style_name', width: 120,
      render: (_: unknown, record) => (
        <StyleTextCell field="style_name" placeholder="款式名称" {...cellProps(record)} />
      ),
    }, sortState),
    withServerSort({
      title: '业务员', dataIndex: 'salesperson', key: 'salesperson', width: 96,
      render: (_: unknown, record) => <StyleSalespersonCell {...brandProps(record)} />,
    }, sortState),
    withServerSort({
      title: 'PO号', dataIndex: 'po_number', key: 'po_number', width: 110,
      render: (_: unknown, record) => (
        <StyleTextCell field="po_number" placeholder="PO号" {...cellProps(record)} />
      ),
    }, sortState),
    withServerSort({
      title: '要求出货日', dataIndex: 'required_shipping_date', key: 'required_shipping_date', width: 120,
      render: (_: unknown, record) => (
        <StyleDateCell field="required_shipping_date" {...cellProps(record)} />
      ),
    }, sortState),
    withServerSort({
      title: '关账月份', dataIndex: 'closing_month', key: 'closing_month', width: 100,
      render: (_: unknown, record) => (
        <StyleClosingMonthCell field="closing_month" {...cellProps(record)} />
      ),
    }, sortState),
    {
      title: '备注', dataIndex: 'remarks', key: 'remarks', width: 160,
      render: (_: unknown, record) => (
        <StyleTextAreaCell field="remarks" placeholder="备注" maxRows={3} {...cellProps(record)} />
      ),
    },
    {
      title: '款式图', dataIndex: 'style_image', key: 'style_image', width: 72,
      render: (v: string) => <StyleImageCell src={v} />,
    },
    {
      title: '面料进度', dataIndex: 'fabric_readiness', key: 'fabric_readiness', width: 180,
      render: (_: unknown, record) => (
        <StyleTextAreaCell field="fabric_readiness" placeholder="面料进度" maxRows={3} {...cellProps(record)} />
      ),
    },
    {
      title: '辅料进度', dataIndex: 'accessories_readiness', key: 'accessories_readiness', width: 180,
      render: (_: unknown, record) => (
        <StyleTextAreaCell field="accessories_readiness" placeholder="辅料进度" maxRows={3} {...cellProps(record)} />
      ),
    },
    {
      title: '面料结构', dataIndex: 'fabric_structure', key: 'fabric_structure', width: 110,
      render: (_: unknown, record) => (
        <StyleTextCell field="fabric_structure" placeholder="面料结构" {...cellProps(record)} />
      ),
    },
    {
      title: '样衣进度', dataIndex: 'sample_progress', key: 'sample_progress', width: 110,
      render: (_: unknown, record) => (
        <StyleTextCell field="sample_progress" placeholder="样衣进度" {...cellProps(record)} />
      ),
    },
    {
      title: '印绣花', dataIndex: 'printing_embroidery', key: 'printing_embroidery', width: 100,
      render: (_: unknown, record) => (
        <StyleTextCell field="printing_embroidery" placeholder="印绣花" {...cellProps(record)} />
      ),
    },
    {
      title: '跟单员', dataIndex: 'order_follower', key: 'order_follower', width: 96,
      render: (_: unknown, record) => (
        <StyleTextCell field="order_follower" placeholder="跟单员" {...cellProps(record)} />
      ),
    },
    withServerSort({
      title: '加工单价', dataIndex: 'processing_unit_price', key: 'processing_unit_price', width: 100,
      render: (_: unknown, record) => (
        <StyleNumberCell field="processing_unit_price" step={0.01} precision={2} {...cellProps(record)} />
      ),
    }, sortState),
    withServerSort({
      title: '加工产值', dataIndex: 'processing_output_value', key: 'processing_output_value', width: 100,
      render: (v: number) => formatMoney(v),
    }, sortState),
    withServerSort({
      title: '销售单价', dataIndex: 'sales_price', key: 'sales_price', width: 100,
      render: (_: unknown, record) => (
        <StyleNumberCell field="sales_price" step={0.01} precision={2} {...cellProps(record)} />
      ),
    }, sortState),
    withServerSort({
      title: '销售产值', dataIndex: 'sales_output_value', key: 'sales_output_value', width: 100,
      render: (v: number) => formatMoney(v),
    }, sortState),
    {
      title: '操作', key: 'action', width: 80, fixed: 'right',
      render: (_: unknown, record: StyleRecord) => (
        <Button
          type="link"
          size="small"
          icon={<HistoryOutlined />}
          onClick={() => setHistoryStyle(record)}
        />
      ),
    },
  ], [savingId, updateLocal, saveField, navigate, brands, sortState]);

  const columns = useMemo(
    () => applyViewColumnPreferences(allColumns, columnPrefs, { onResize, onResizeStop }),
    [allColumns, columnPrefs, onResize, onResizeStop],
  );

  const scrollX = useMemo(() => estimateScrollX(columns as ColumnsType<unknown>), [columns]);

  return (
    <div>
      <div className="card-panel mb-4 scheduling-toolbar">
        <Space wrap className="w-full justify-between">
          <Space wrap>
            <Input.Search
              placeholder="搜索款号/品牌/PO"
              allowClear
              style={{ width: 220 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onSearch={setSearch}
            />
            <Select
              placeholder="品牌"
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: 130 }}
              value={brandFilter}
              onChange={(v) => {
                setBrandFilter(v);
                setSalespersonFilter(undefined);
              }}
              options={brands.map((b) => ({ value: b.name, label: b.name }))}
            />
            <Select
              placeholder="业务员"
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: 120 }}
              value={salespersonFilter}
              onChange={setSalespersonFilter}
              options={salespersonFilterOptions}
            />
            <Select
              placeholder="关账月份"
              allowClear
              style={{ width: 120 }}
              value={closingMonthFilter}
              onChange={setClosingMonthFilter}
              options={CLOSING_MONTH_OPTIONS.map((m) => ({ value: m, label: m }))}
            />
            <Space>
              <span className="text-sm text-gray-500">仅未排单</span>
              <Switch checked={unscheduledOnly} onChange={setUnscheduledOnly} />
            </Space>
            <Button icon={<ReloadOutlined />} onClick={resetFilters}>
              重置筛选
            </Button>
          </Space>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/scheduling/styles/new')}>
              新建款式预警
            </Button>
            <TableColumnSettings
              columns={EARLY_WARNING_COLUMNS}
              value={columnPrefs}
              onChange={setColumnPrefs}
              onPersist={persistColumnPrefs}
            />
          </Space>
        </Space>
        <p className="scheduling-toolbar-hint">
          支持品牌/业务员/关账月份筛选；点击表头排序；拖拽列边线调宽；列设置中可隐藏字段、拖拽调序与设宽
        </p>
      </div>

      <div className="card-panel">
        <Table
          className="quotation-list-table scheduling-edit-table"
          rowKey="id"
          components={TABLE_HEADER_COMPONENTS}
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: scrollX }}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
          rowClassName={(record) => (isUnscheduled(record) ? 'unscheduled-warning' : '')}
          onChange={handleTableChange}
        />
      </div>

      <StyleHistoryDrawer
        open={!!historyStyle}
        styleId={historyStyle?.id ?? null}
        styleLabel={historyStyle?.style_number}
        onClose={() => setHistoryStyle(null)}
      />
    </div>
  );
}
