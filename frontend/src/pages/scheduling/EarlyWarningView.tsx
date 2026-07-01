import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Switch, Input, Select, Space, Button, message, Tooltip } from 'antd';
import { EditOutlined, HistoryOutlined, PlusOutlined, ReloadOutlined, FileExcelOutlined, StopOutlined } from '@ant-design/icons';
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
  defaultClosingMonthRange,
  closingMonthRangeToCsv,
  normalizeClosingMonthRange,
  type ClosingMonthRange,
} from '@/utils/closingMonthRange';
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
import type { StyleRecord } from '@/types/style';
import { ORDER_TYPE_LABELS } from '@/types/style';
import ClosingMonthRangeFilter from '@/components/scheduling/ClosingMonthRangeFilter';
import {
  saveEarlyWarningSearchScope,
  type EarlyWarningSearchScope,
} from '@/utils/schedulingFilters';
import EarlyWarningFieldFilter from '@/components/scheduling/EarlyWarningFieldFilter';
import EarlyWarningExportModal from '@/components/scheduling/EarlyWarningExportModal';
import CancelOrderModal from '@/components/scheduling/CancelOrderModal';
import type { FieldFilterState } from '@/utils/earlyWarningFieldFilter';
import {
  formatOutputValueNumber,
  formatSumProcessingOutputNumber,
  formatSumSalesOutputNumber,
  sumOutputValues,
} from '@/utils/earlyWarningExport';
import { useAuth } from '@/contexts/AuthContext';
import { enrichStyleClient, formatDate, isProcessingOrder, isUnscheduled } from '@/utils/styleCalculations';
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

function mergeStyleRowsById(...groups: StyleRecord[][]): StyleRecord[] {
  const map = new Map<number, StyleRecord>();
  for (const group of groups) {
    for (const row of group) map.set(row.id, row);
  }
  return Array.from(map.values());
}

function sortStylesClient(rows: StyleRecord[], sortState: SortState): StyleRecord[] {
  if (!sortState.field || !sortState.order) return rows;
  const field = sortState.field;
  const dir = sortState.order === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = a[field as keyof StyleRecord];
    const bv = b[field as keyof StyleRecord];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv), 'zh-CN') * dir;
  });
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
  const restoreFromCache = !!(
    cache
    && filtersMatch(cache, filters)
    && filters.searchScope !== 'accumulate'
  );
  return { filters, cache, restoreFromCache };
}

export default function EarlyWarningView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const initialState = useMemo(() => getInitialEarlyWarningState(), []);
  const { filters: initialFilters, cache: initialCache, restoreFromCache } = initialState;

  const [data, setData] = useState<StyleRecord[]>(() => {
    if (restoreFromCache) return initialCache!.data;
    if (initialFilters.searchScope === 'accumulate') return [];
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(initialFilters.searchInput);
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [searchScope, setSearchScope] = useState<EarlyWarningSearchScope>(initialFilters.searchScope);
  const isAccumulateMode = searchScope === 'accumulate';
  const useGlobalSearch = searchScope === 'global' && !!debouncedSearch;
  const [accumulatedRows, setAccumulatedRows] = useState<StyleRecord[]>([]);
  const [fieldFilter, setFieldFilter] = useState<FieldFilterState | null>(initialFilters.fieldFilter);
  const [closingMonthRange, setClosingMonthRange] = useState<ClosingMonthRange>(initialFilters.closingMonthRange);
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
  const [cancelRecord, setCancelRecord] = useState<StyleRecord | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
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

  const displayData = useMemo(() => {
    if (!isAccumulateMode) return data;
    return sortStylesClient(data, sortState);
  }, [data, isAccumulateMode, sortState]);

  const selectedRows = useMemo(
    () => displayData.filter((row) => selectedRowKeys.includes(row.id)),
    [displayData, selectedRowKeys],
  );

  const allTotals = useMemo(() => sumOutputValues(displayData), [displayData]);
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
        closing_month: useGlobalSearch ? undefined : closingMonthRangeToCsv(closingMonthRange) || undefined,
        filter_field: useGlobalSearch ? undefined : fieldFilter?.field,
        filter_values: useGlobalSearch ? undefined : (fieldFilter?.values.length ? fieldFilter.values.join(',') : undefined),
        sort_by: sortState.field,
        sort_order: sortState.order,
      });
      setData((res.data || []).map(enrichStyleClient));
    } catch (err) {
      message.error(String(err));
    } finally {
      setLoading(false);
    }
  }, [unscheduledOnly, debouncedSearch, useGlobalSearch, fieldFilter, closingMonthRange, sortState]);

  const handleAccumulateSearch = useCallback(async (term?: string) => {
    const trimmed = (term ?? searchInput).trim();
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

      const selectedFromView = data.filter((row) => selectedRowKeys.includes(row.id));
      const mergedAccumulated = mergeStyleRowsById(accumulatedRows, selectedFromView);
      setAccumulatedRows(mergedAccumulated);

      if (!trimmed) {
        setData(mergedAccumulated);
        setSearchInput('');
        resetPage();
        return;
      }

      const res = await getStyles({
        view: 'early_warning',
        search: trimmed,
        sort_by: sortState.field,
        sort_order: sortState.order,
      });
      const hits = (res.data || []).map(enrichStyleClient);
      if (hits.length === 0) {
        message.info(`未找到匹配「${trimmed}」的款式`);
      }
      setData(mergeStyleRowsById(mergedAccumulated, hits));
      setSearchInput('');
      resetPage();
    } catch (err) {
      message.error(String(err));
    } finally {
      setLoading(false);
    }
  }, [searchInput, data, selectedRowKeys, accumulatedRows, sortState, resetPage]);

  useEffect(() => {
    saveEarlyWarningFilters({
      searchInput,
      searchScope,
      fieldFilter,
      closingMonthRange,
      unscheduledOnly,
    });
  }, [searchInput, searchScope, fieldFilter, closingMonthRange, unscheduledOnly]);

  useEffect(() => {
    if (skipInitialLoadRef.current) {
      skipInitialLoadRef.current = false;
      clearEarlyWarningListCache();
      return;
    }
    if (isAccumulateMode) return;
    loadData();
  }, [loadData, isAccumulateMode]);

  useEffect(() => {
    if (skipFilterResetPageRef.current) {
      skipFilterResetPageRef.current = false;
      return;
    }
    if (isAccumulateMode) return;
    resetPage();
  }, [unscheduledOnly, debouncedSearch, useGlobalSearch, fieldFilter, closingMonthRange, sortState, resetPage, isAccumulateMode]);

  const handleOpenStyleDetail = useCallback((record: StyleRecord) => {
    saveEarlyWarningListCache({
      searchInput,
      searchScope,
      fieldFilter,
      closingMonthRange,
      unscheduledOnly,
      data,
      selectedRowKeys,
      page,
    });
    navigate(`/scheduling/styles/${record.id}`, { state: { schedulingTab: 'early_warning' } });
  }, [
    searchInput, searchScope, fieldFilter, closingMonthRange,
    unscheduledOnly, data, selectedRowKeys, page, navigate,
  ]);

  const resetFilters = () => {
    clearEarlyWarningListCache();
    setSearchInput('');
    setSearchScope('local');
    saveEarlyWarningSearchScope('local');
    setFieldFilter(null);
    setClosingMonthRange(defaultClosingMonthRange());
    setUnscheduledOnly(false);
    setSelectedRowKeys([]);
    setAccumulatedRows([]);
    const defaultSort: SortState = {};
    setSortState(defaultSort);
    saveSortState(defaultSort);
    setPage(1);
  };

  const clearAccumulated = () => {
    setAccumulatedRows([]);
    if (isAccumulateMode) {
      setData([]);
      setSelectedRowKeys([]);
    }
  };

  const patchRowInLists = useCallback((updated: StyleRecord) => {
    setData((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    setAccumulatedRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
  }, []);

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
    {
      title: '订单类型', dataIndex: 'order_type', key: 'order_type', width: 90,
      render: (v: StyleRecord['order_type']) => (
        <ReadOnlyCell value={ORDER_TYPE_LABELS[v ?? 'distribution']} />
      ),
    },
    {
      title: '取消件数', dataIndex: 'cancelled_quantity', key: 'cancelled_quantity', width: 90,
      render: (v: number) => <ReadOnlyCell value={v > 0 ? v : undefined} placeholder="—" />,
    },
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
      title: '加工产值（万美金）', dataIndex: 'processing_output_value', key: 'processing_output_value', width: 120,
      render: (v: number) => <ReadOnlyCell value={formatOutputValueNumber(v)} />,
    }, sortState),
    withServerSort({
      title: '销售单价', dataIndex: 'sales_price', key: 'sales_price', width: 100,
      render: (v: number) => <ReadOnlyCell value={v} />,
    }, sortState),
    withServerSort({
      title: '销售产值（万元）', dataIndex: 'sales_output_value', key: 'sales_output_value', width: 120,
      render: (v: number) => <ReadOnlyCell value={formatOutputValueNumber(v)} />,
    }, sortState),
    {
      title: '操作', key: 'action', width: 120, fixed: 'right',
      render: (_: unknown, record: StyleRecord) => (
        <Space size={0}>
          <Button
            type="link"
            size="small"
            icon={<StopOutlined />}
            onClick={() => setCancelRecord(record)}
            disabled={(record.quantity ?? 0) < 1}
          >
            取消
          </Button>
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => setHistoryStyle(record)}
          />
        </Space>
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

  const exportMetaInput = useMemo(() => ({
    exportUser: user?.displayName || user?.username || '',
    exportTime: '',
    searchScope,
    searchKeyword: searchInput,
    closingMonthRange,
    fieldFilter,
    unscheduledOnly,
    sortField: sortState.field,
    sortOrder: sortState.order,
  }), [
    user?.displayName,
    user?.username,
    searchScope,
    searchInput,
    closingMonthRange,
    fieldFilter,
    unscheduledOnly,
    sortState.field,
    sortState.order,
  ]);

  return (
    <div>
      <div className="card-panel mb-4 scheduling-toolbar">
        <Space wrap className="w-full justify-between" align="end">
          <div className="filter-toolbar">
            <FilterField label="搜索">
              <Space.Compact className="early-warning-search-compact">
                <Tooltip title={
                  searchScope === 'local'
                    ? '在当前筛选条件下搜索'
                    : searchScope === 'global'
                      ? '忽略筛选，在全库款式中搜索'
                      : '模糊搜索：勾选需要的行后回车搜下一款；清空搜索框仅显示已累计款式'
                }>
                  <Select
                    value={searchScope}
                    className="early-warning-search-scope"
                    popupMatchSelectWidth={false}
                    options={[
                      { value: 'local', label: '局部' },
                      { value: 'global', label: '全局' },
                      { value: 'accumulate', label: '累计' },
                    ]}
                    onChange={(v: EarlyWarningSearchScope) => {
                      setSearchScope(v);
                      saveEarlyWarningSearchScope(v);
                      if (v === 'accumulate') {
                        setSearchInput('');
                        setData(accumulatedRows);
                        skipFilterResetPageRef.current = true;
                      }
                    }}
                  />
                </Tooltip>
                <Input.Search
                  placeholder={
                    isAccumulateMode
                      ? '款号 / 品牌 / PO，勾选后回车搜下一款'
                      : searchScope === 'local'
                        ? '款号 / 品牌 / PO'
                        : '全库搜索款号 / 品牌 / PO'
                  }
                  allowClear
                  className="early-warning-search-input"
                  value={searchInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSearchInput(v);
                    if (isAccumulateMode && v === '') {
                      void handleAccumulateSearch('');
                    }
                  }}
                  onSearch={(v) => {
                    if (isAccumulateMode) {
                      void handleAccumulateSearch(v);
                    } else {
                      setSearchInput(v);
                    }
                  }}
                />
              </Space.Compact>
            </FilterField>
            <FilterField label="字段筛选">
              <EarlyWarningFieldFilter
                value={fieldFilter}
                onChange={setFieldFilter}
                closingMonthRange={closingMonthRange}
                unscheduledOnly={unscheduledOnly}
                disabled={useGlobalSearch || isAccumulateMode}
              />
            </FilterField>
            <ClosingMonthRangeFilter
              value={closingMonthRange}
              onChange={(range) => setClosingMonthRange(normalizeClosingMonthRange(range.startMonth, range.endMonth))}
              disabled={isAccumulateMode}
            />
            <FilterField label="仅未排单">
              <Switch checked={unscheduledOnly} onChange={setUnscheduledOnly} disabled={isAccumulateMode} />
            </FilterField>
            <Button icon={<ReloadOutlined />} onClick={resetFilters}>
              重置
            </Button>
          </div>
          <Space>
            <Button
              icon={<FileExcelOutlined />}
              disabled={displayData.length === 0}
              onClick={() => setExportOpen(true)}
            >
              导出 Excel
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
          {isAccumulateMode
            ? '累计模式：输入关键词并回车（模糊匹配款号/品牌/PO）；勾选需要的行后再搜下一款，已勾选款式会加入累计列表；清空搜索框仅显示累计区。'
            : '支持全选/多选筛选；加工产值与销售产值始终显示合计（未勾选时统计当前筛选结果，勾选后统计选中行）。局部搜索在当前筛选内查找，全局搜索将忽略字段筛选/关账月份等条件。'}
        </p>
      </div>

      <div className="early-warning-selection-bar card-panel mb-4">
        <span>
          {isAccumulateMode ? (
            <>
              已累计 <strong>{accumulatedRows.length}</strong> 条
              · 当前列表 <strong>{displayData.length}</strong> 条
              {hasSelection && <> · 已选 <strong>{selectedRowKeys.length}</strong> 条</>}
            </>
          ) : hasSelection ? (
            <>已选 <strong>{selectedRowKeys.length}</strong> 条</>
          ) : (
            <>当前筛选 <strong>{displayData.length}</strong> 条</>
          )}
        </span>
        <span>加工产值合计 <strong>{formatSumProcessingOutputNumber(outputTotals.processing)}</strong> <span className="text-gray-400 text-sm">万美金</span></span>
        <span>销售产值合计 <strong>{formatSumSalesOutputNumber(outputTotals.sales)}</strong> <span className="text-gray-400 text-sm">万元</span></span>
        {isAccumulateMode && accumulatedRows.length > 0 && (
          <Button type="link" className="!px-0" onClick={clearAccumulated}>
            清空累计
          </Button>
        )}
        {hasSelection && (
          <Button type="link" className="!px-0" onClick={() => setSelectedRowKeys([])}>
            清空选择
          </Button>
        )}
      </div>

      <div className="card-panel early-warning-table-panel">
        <Table
          className="quotation-list-table scheduling-readonly-table"
          rowKey="id"
          tableLayout="fixed"
          components={TABLE_HEADER_COMPONENTS}
          columns={columns}
          dataSource={displayData}
          loading={loading}
          scroll={{ x: scrollX, y: 'calc(100vh - 320px)' }}
          sticky
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
                onSelect: () => setSelectedRowKeys(displayData.map((r) => r.id)),
              },
              Table.SELECTION_INVERT,
              Table.SELECTION_NONE,
            ],
          }}
          rowClassName={(record) => {
            const classes: string[] = [];
            if (isUnscheduled(record)) classes.push('unscheduled-warning');
            if (isProcessingOrder(record)) classes.push('order-type-processing');
            return classes.join(' ');
          }}
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
          patchRowInLists(enrichStyleClient(updated));
        }}
      />

      <EarlyWarningExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        columnPrefs={columnPrefs}
        selectedRows={selectedRows}
        filteredRows={displayData}
        metaInput={exportMetaInput}
      />

      <CancelOrderModal
        open={!!cancelRecord}
        record={cancelRecord}
        onClose={() => setCancelRecord(null)}
        onSuccess={() => void loadData()}
      />
    </div>
  );
}
