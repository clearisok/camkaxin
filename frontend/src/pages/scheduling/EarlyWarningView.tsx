import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Switch, Input, Select, Space, Button, message, Tooltip } from 'antd';
import { EditOutlined, HistoryOutlined, PlusOutlined, ReloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig, TableProps } from 'antd/es/table';
import type { SorterResult } from 'antd/es/table/interface';
import FilterField from '@/components/FilterField';
import TableColumnSettings from '@/components/TableColumnSettings';
import ResizableTableHeader from '@/components/ResizableTableHeader';
import StyleHistoryDrawer from '@/components/scheduling/StyleHistoryDrawer';
import StyleImageCell from '@/components/scheduling/StyleImageCell';
import ReadOnlyCell from '@/components/scheduling/ReadOnlyCell';
import StyleRowEditDrawer from '@/components/scheduling/StyleRowEditDrawer';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  defaultClosingMonth,
  saveEarlyWarningSearchScope,
  type EarlyWarningSearchScope,
} from '@/utils/schedulingFilters';
import {
  clearEarlyWarningListCache,
  filtersMatch,
  isEarlyWarningGapsFilled,
  loadEarlyWarningFilters,
  loadEarlyWarningListCache,
  markEarlyWarningGapsFilled,
  saveEarlyWarningFilters,
  saveEarlyWarningListCache,
} from '@/utils/earlyWarningSession';
import { fillEarlyWarningGaps, getStyles } from '@/api/styles';
import { getBrands } from '@/api';
import type { Brand } from '@/types';
import type { StyleRecord } from '@/types/style';
import ClosingMonthSelect from '@/components/scheduling/ClosingMonthSelect';
import {
  exportEarlyWarningCsv,
  formatProcessingOutputDisplay,
  formatSalesOutputDisplay,
  formatSumProcessingOutput,
  formatSumSalesOutput,
  sumOutputValues,
} from '@/utils/earlyWarningExport';
import { enrichStyleClient, formatDate, isUnscheduled } from '@/utils/styleCalculations';
import { formatMaterialText, groupLabel } from '@/utils/schedulingZone';
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
import { useTablePagination } from '@/utils/tablePagination';

const EARLY_WARNING_SORT_STORAGE_KEY = 'scheduling-early-warning-sort';
const EARLY_WARNING_PAGE_SIZE_KEY = 'scheduling-early-warning-page-size';
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

function getInitialEarlyWarningState() {
  const filters = loadEarlyWarningFilters();
  const cache = loadEarlyWarningListCache();
  const restoreFromCache = !!(cache && filtersMatch(cache, filters));
  return { filters, cache, restoreFromCache };
}

export default function EarlyWarningView() {
  const navigate = useNavigate();
  const initialState = useMemo(() => getInitialEarlyWarningState(), []);
  const { filters: initialFilters, cache: initialCache, restoreFromCache } = initialState;

  const [data, setData] = useState<StyleRecord[]>(() => (restoreFromCache ? initialCache!.data : []));
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(initialFilters.searchInput);
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [searchScope, setSearchScope] = useState<EarlyWarningSearchScope>(initialFilters.searchScope);
  const useGlobalSearch = searchScope === 'global' && !!debouncedSearch;
  const [brandFilters, setBrandFilters] = useState<string[]>(initialFilters.brandFilters);
  const [salespersonFilters, setSalespersonFilters] = useState<string[]>(initialFilters.salespersonFilters);
  const [closingMonthFilters, setClosingMonthFilters] = useState<string[]>(initialFilters.closingMonthFilters);
  const [unscheduledOnly, setUnscheduledOnly] = useState(initialFilters.unscheduledOnly);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>(() =>
    restoreFromCache ? initialCache!.selectedRowKeys : [],
  );
  const [sortState, setSortState] = useState<SortState>(loadSortState);
  const [columnPrefs, setColumnPrefs] = useState<ColumnPreferences>(() =>
    loadViewColumnPreferences(EARLY_WARNING_STORAGE_KEY, EARLY_WARNING_COLUMNS)
  );
  const [historyStyle, setHistoryStyle] = useState<StyleRecord | null>(null);
  const [editRecord, setEditRecord] = useState<StyleRecord | null>(null);
  const { applyPagination, resetPage, setPage, paginationConfig, page } = useTablePagination(
    EARLY_WARNING_PAGE_SIZE_KEY,
    restoreFromCache ? initialCache!.page : 1,
  );
  const gapsFilledRef = useRef(isEarlyWarningGapsFilled());
  const skipInitialLoadRef = useRef(restoreFromCache);
  const skipFilterResetPageRef = useRef(restoreFromCache);

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
    const selectedBrands = brandFilters.length
      ? brands.filter((b) => brandFilters.includes(b.name))
      : brands;
    const source = selectedBrands.flatMap((b) => b.agents || []);
    const names = [...new Set(source.map((a) => a.name).filter(Boolean))];
    return names.sort((a, b) => a.localeCompare(b, 'zh-CN')).map((name) => ({ value: name, label: name }));
  }, [brands, brandFilters]);

  const selectedRows = useMemo(
    () => data.filter((row) => selectedRowKeys.includes(row.id)),
    [data, selectedRowKeys],
  );

  const allTotals = useMemo(() => sumOutputValues(data), [data]);
  const selectionTotals = useMemo(() => sumOutputValues(selectedRows), [selectedRows]);
  const hasSelection = selectedRowKeys.length > 0;
  const outputTotals = hasSelection ? selectionTotals : allTotals;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (!gapsFilledRef.current) {
        try {
          await fillEarlyWarningGaps();
        } catch {
          /* 补全失败不阻断列表加载 */
        }
        gapsFilledRef.current = true;
        markEarlyWarningGapsFilled();
      }
      const res = await getStyles({
        view: 'early_warning',
        unscheduled_only: useGlobalSearch ? undefined : unscheduledOnly,
        search: debouncedSearch || undefined,
        brand: useGlobalSearch ? undefined : (brandFilters.length ? brandFilters.join(',') : undefined),
        salesperson: useGlobalSearch ? undefined : (salespersonFilters.length ? salespersonFilters.join(',') : undefined),
        closing_month: useGlobalSearch ? undefined : (closingMonthFilters.length ? closingMonthFilters.join(',') : undefined),
        sort_by: sortState.field,
        sort_order: sortState.order,
      });
      setData((res.data || []).map(enrichStyleClient));
    } catch (err) {
      message.error(String(err));
    } finally {
      setLoading(false);
    }
  }, [unscheduledOnly, debouncedSearch, useGlobalSearch, brandFilters, salespersonFilters, closingMonthFilters, sortState]);

  useEffect(() => {
    saveEarlyWarningFilters({
      searchInput,
      searchScope,
      brandFilters,
      salespersonFilters,
      closingMonthFilters,
      unscheduledOnly,
    });
  }, [searchInput, searchScope, brandFilters, salespersonFilters, closingMonthFilters, unscheduledOnly]);

  useEffect(() => {
    if (skipInitialLoadRef.current) {
      skipInitialLoadRef.current = false;
      clearEarlyWarningListCache();
      return;
    }
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (skipFilterResetPageRef.current) {
      skipFilterResetPageRef.current = false;
      return;
    }
    resetPage();
  }, [unscheduledOnly, debouncedSearch, useGlobalSearch, brandFilters, salespersonFilters, closingMonthFilters, sortState, resetPage]);

  const handleOpenStyleDetail = useCallback((record: StyleRecord) => {
    saveEarlyWarningListCache({
      searchInput,
      searchScope,
      brandFilters,
      salespersonFilters,
      closingMonthFilters,
      unscheduledOnly,
      data,
      selectedRowKeys,
      page,
    });
    navigate(`/scheduling/styles/${record.id}`, { state: { schedulingTab: 'early_warning' } });
  }, [
    searchInput, searchScope, brandFilters, salespersonFilters, closingMonthFilters,
    unscheduledOnly, data, selectedRowKeys, page, navigate,
  ]);

  const resetFilters = () => {
    clearEarlyWarningListCache();
    setSearchInput('');
    setSearchScope('local');
    saveEarlyWarningSearchScope('local');
    setBrandFilters([]);
    setSalespersonFilters([]);
    setClosingMonthFilters([defaultClosingMonth()]);
    setUnscheduledOnly(false);
    setSelectedRowKeys([]);
    const defaultSort: SortState = {};
    setSortState(defaultSort);
    saveSortState(defaultSort);
    setPage(1);
  };

  const handleTableChange: TableProps<StyleRecord>['onChange'] = (pagination, _filters, sorter) => {
    applyPagination(pagination as TablePaginationConfig);
    const item = (Array.isArray(sorter) ? sorter[0] : sorter) as SorterResult<StyleRecord>;
    const field = item?.columnKey as string | undefined;
    const order = item?.order === 'descend' ? 'desc' : item?.order === 'ascend' ? 'asc' : undefined;
    const next: SortState = field && order ? { field, order } : {};
    setSortState(next);
    saveSortState(next);
  };

  const allColumns: ColumnsType<StyleRecord> = useMemo(() => [
    {
      title: '',
      key: 'row_edit',
      width: 40,
      fixed: 'left',
      className: 'row-edit-col',
      render: (_: unknown, record: StyleRecord) => (
        <Button
          type="text"
          size="small"
          className="row-edit-btn"
          icon={<EditOutlined />}
          aria-label="编辑"
          onClick={() => setEditRecord(record)}
        />
      ),
    },
    withServerSort({
      title: '款号', dataIndex: 'style_number', key: 'style_number', width: 110, fixed: 'left',
      render: (v: string, record: StyleRecord) => (
        <Button
          type="link"
          size="small"
          className="!px-0 font-medium"
          onClick={() => handleOpenStyleDetail(record)}
        >
          {v || '—'}
        </Button>
      ),
    }, sortState),
    withServerSort({
      title: '品牌', dataIndex: 'brand', key: 'brand', width: 100,
      render: (v: string) => <ReadOnlyCell value={v} />,
    }, sortState),
    withServerSort({
      title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80,
      render: (v: number) => <ReadOnlyCell value={v} />,
    }, sortState),
    withServerSort({
      title: '款式名称', dataIndex: 'style_name', key: 'style_name', width: 120,
      render: (v: string) => <ReadOnlyCell value={v} />,
    }, sortState),
    withServerSort({
      title: '业务员', dataIndex: 'salesperson', key: 'salesperson', width: 96,
      render: (v: string) => <ReadOnlyCell value={v} />,
    }, sortState),
    withServerSort({
      title: 'PO号', dataIndex: 'po_number', key: 'po_number', width: 110,
      render: (v: string) => <ReadOnlyCell value={v} />,
    }, sortState),
    withServerSort({
      title: '要求出货日', dataIndex: 'required_shipping_date', key: 'required_shipping_date', width: 120,
      render: (v: string) => <ReadOnlyCell value={formatDate(v)} placeholder="—" />,
    }, sortState),
    withServerSort({
      title: '关账月份', dataIndex: 'closing_month', key: 'closing_month', width: 100,
      render: (v: string) => <ReadOnlyCell value={v} />,
    }, sortState),
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
    withServerSort({
      title: '加工单价', dataIndex: 'processing_unit_price', key: 'processing_unit_price', width: 100,
      render: (v: number) => <ReadOnlyCell value={v} />,
    }, sortState),
    withServerSort({
      title: '加工产值', dataIndex: 'processing_output_value', key: 'processing_output_value', width: 120,
      render: (v: number) => formatProcessingOutputDisplay(v),
    }, sortState),
    withServerSort({
      title: '销售单价', dataIndex: 'sales_price', key: 'sales_price', width: 100,
      render: (v: number) => <ReadOnlyCell value={v} />,
    }, sortState),
    withServerSort({
      title: '销售产值', dataIndex: 'sales_output_value', key: 'sales_output_value', width: 120,
      render: (v: number) => formatSalesOutputDisplay(v),
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
  ], [handleOpenStyleDetail, sortState]);

  const columns = useMemo(
    () => applyViewColumnPreferences(allColumns, columnPrefs, {
      onResize,
      onResizeStop,
      cellAlign: 'left',
      prependKeys: ['row_edit'],
    }),
    [allColumns, columnPrefs, onResize, onResizeStop],
  );

  const scrollX = useMemo(() => estimateScrollX(columns as ColumnsType<unknown>), [columns]);

  const handleExportSelected = () => {
    if (selectedRows.length === 0) {
      message.warning('请先勾选要导出的款式');
      return;
    }
    exportEarlyWarningCsv(selectedRows);
    message.success(`已导出 ${selectedRows.length} 条`);
  };

  return (
    <div>
      <div className="card-panel mb-4 scheduling-toolbar">
        <Space wrap className="w-full justify-between" align="end">
          <div className="filter-toolbar">
            <FilterField label="搜索">
              <Space.Compact className="early-warning-search-compact">
                <Tooltip title={searchScope === 'local' ? '在当前筛选条件下搜索' : '忽略筛选，在全库款式中搜索'}>
                  <Select
                    value={searchScope}
                    className="early-warning-search-scope"
                    popupMatchSelectWidth={false}
                    options={[
                      { value: 'local', label: '局部' },
                      { value: 'global', label: '全局' },
                    ]}
                    onChange={(v: EarlyWarningSearchScope) => {
                      setSearchScope(v);
                      saveEarlyWarningSearchScope(v);
                    }}
                  />
                </Tooltip>
                <Input.Search
                  placeholder={searchScope === 'local' ? '款号 / 品牌 / PO' : '全库搜索款号 / 品牌 / PO'}
                  allowClear
                  className="early-warning-search-input"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onSearch={setSearchInput}
                />
              </Space.Compact>
            </FilterField>
            <FilterField label="品牌">
              <Select
                mode="multiple"
                placeholder="全部"
                allowClear
                showSearch
                maxTagCount="responsive"
                optionFilterProp="label"
                style={{ minWidth: 160 }}
                value={brandFilters}
                onChange={(v) => {
                  setBrandFilters(v);
                  setSalespersonFilters([]);
                }}
                options={brands.map((b) => ({ value: b.name, label: b.name }))}
              />
            </FilterField>
            <FilterField label="业务员">
              <Select
                mode="multiple"
                placeholder="全部"
                allowClear
                showSearch
                maxTagCount="responsive"
                optionFilterProp="label"
                style={{ minWidth: 150 }}
                value={salespersonFilters}
                onChange={setSalespersonFilters}
                options={salespersonFilterOptions}
              />
            </FilterField>
            <FilterField label="关账月份">
              <ClosingMonthSelect
                mode="multiple"
                placeholder="全部"
                allowClear
                maxTagCount="responsive"
                style={{ minWidth: 160 }}
                value={closingMonthFilters}
                onChange={setClosingMonthFilters}
                scrollToMonth={closingMonthFilters[0] || defaultClosingMonth()}
              />
            </FilterField>
            <FilterField label="仅未排单">
              <Switch checked={unscheduledOnly} onChange={setUnscheduledOnly} />
            </FilterField>
            <Button icon={<ReloadOutlined />} onClick={resetFilters}>
              重置
            </Button>
          </div>
          <Space>
            <Button
              icon={<FileExcelOutlined />}
              disabled={selectedRowKeys.length === 0}
              onClick={handleExportSelected}
            >
              导出选中{selectedRowKeys.length > 0 ? ` (${selectedRowKeys.length})` : ''}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/scheduling/styles/new', { state: { schedulingTab: 'early_warning' } })}
            >
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
          支持全选/多选筛选；加工产值与销售产值始终显示合计（未勾选时统计当前筛选结果，勾选后统计选中行）。局部搜索在当前筛选内查找，全局搜索将忽略品牌/业务员/关账月份等条件。
        </p>
      </div>

      <div className="early-warning-selection-bar card-panel mb-4">
        <span>
          {hasSelection ? (
            <>已选 <strong>{selectedRowKeys.length}</strong> 条</>
          ) : (
            <>当前筛选 <strong>{data.length}</strong> 条</>
          )}
        </span>
        <span>加工产值合计 <strong>{formatSumProcessingOutput(outputTotals.processing)}</strong></span>
        <span>销售产值合计 <strong>{formatSumSalesOutput(outputTotals.sales)}</strong></span>
        {hasSelection && (
          <Button type="link" className="!px-0" onClick={() => setSelectedRowKeys([])}>
            清空选择
          </Button>
        )}
      </div>

      <div className="card-panel">
        <Table
          className="quotation-list-table scheduling-readonly-table"
          rowKey="id"
          tableLayout="fixed"
          components={TABLE_HEADER_COMPONENTS}
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: scrollX }}
          pagination={{
            ...paginationConfig,
            showTotal: (t) => `共 ${t} 条`,
          }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as number[]),
            preserveSelectedRowKeys: true,
            selections: [
              Table.SELECTION_ALL,
              {
                key: 'select-all-filtered',
                text: '全选筛选结果',
                onSelect: () => setSelectedRowKeys(data.map((r) => r.id)),
              },
              Table.SELECTION_INVERT,
              Table.SELECTION_NONE,
            ],
          }}
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

      <StyleRowEditDrawer
        record={editRecord}
        open={!!editRecord}
        onClose={() => setEditRecord(null)}
        onSaved={(updated) => {
          const enriched = enrichStyleClient(updated);
          setData((prev) => prev.map((row) => (row.id === enriched.id ? enriched : row)));
        }}
      />
    </div>
  );
}
