import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, message, Segmented, Select, Space, Tooltip } from 'antd';
import {
  CheckOutlined, FolderOpenOutlined, ReloadOutlined, UndoOutlined,
} from '@ant-design/icons';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import StyleHistoryDrawer from '@/components/scheduling/StyleHistoryDrawer';
import ClosingMonthCardView from '@/components/scheduling/ClosingMonthCardView';
import ClosingMonthTableView, { type DraftStyle } from '@/components/scheduling/ClosingMonthTableView';
import ClosingMonthLockModal from '@/components/scheduling/ClosingMonthLockModal';
import ClosedClosingArchiveDrawer from '@/components/scheduling/ClosedClosingArchiveDrawer';
import ClosingUndoDrawer from '@/components/scheduling/ClosingUndoDrawer';
import ClosingMonthRangeFilter from '@/components/scheduling/ClosingMonthRangeFilter';
import TableColumnSettings from '@/components/TableColumnSettings';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { bulkUpdateStyles, getStyles, lockClosingMonth } from '@/api/styles';
import type { StyleRecord } from '@/types/style';
import { CLOSING_MONTH_OPTIONS } from '@/types/style';
import { enrichStyleClient, formatMoney } from '@/utils/styleCalculations';
import {
  buildClosingChartData,
  groupStylesByClosingMonth,
  type ClosingMonthGroup,
} from '@/utils/closingMonthView';
import {
  closingMonthRangeToCsv,
  defaultClosingMonthRange,
  normalizeClosingMonthRange,
  type ClosingMonthRange,
} from '@/utils/closingMonthRange';
import {
  createEditStep,
  type ClosingEditStep,
} from '@/utils/closingEditSteps';
import type { ColumnPreferences } from '@/utils/quotationListColumnPrefs';
import {
  CLOSING_COLUMNS,
  CLOSING_DEFAULT_WIDTHS,
  CLOSING_STORAGE_KEY,
  loadViewColumnPreferences,
  normalizeViewColumnPreferences,
  saveViewColumnPreferences,
} from '@/utils/schedulingColumnPrefs';
import { createColumnResizeHandlers } from '@/utils/viewColumnUtils';

const VIEW_MODE_KEY = 'closing-month-view-mode';
const CHART_NORMAL_OPEN = '#2563eb';
const CHART_NORMAL_LOCKED = '#1e3a8a';
const CHART_OUTSOURCE_OPEN = '#93c5fd';
const CHART_OUTSOURCE_LOCKED = '#3b82f6';
const CHART_PROCESSING_OPEN = '#22c55e';
const CHART_PROCESSING_LOCKED = '#15803d';

type ClosingSearchScope = 'local' | 'global';

type StyleBaseline = {
  closing_month?: string;
  processing_unit_price?: number;
};

function enrichDraft(row: StyleRecord): DraftStyle {
  return { ...enrichStyleClient(row), _dirty: false };
}

function loadViewMode(): 'card' | 'table' {
  try {
    return localStorage.getItem(VIEW_MODE_KEY) === 'table' ? 'table' : 'card';
  } catch {
    return 'card';
  }
}

function buildBaselineMap(rows: StyleRecord[]): Map<number, StyleBaseline> {
  return new Map(rows.map((r) => [r.id, {
    closing_month: r.closing_month,
    processing_unit_price: r.processing_unit_price,
  }]));
}

function collectEditSteps(
  row: DraftStyle,
  patch: Partial<DraftStyle>,
  baseline: StyleBaseline | undefined,
): ClosingEditStep[] {
  const steps: ClosingEditStep[] = [];
  if (patch.closing_month !== undefined && patch.closing_month !== row.closing_month) {
    steps.push(createEditStep(
      row.id,
      row.style_number ?? '',
      'closing_month',
      baseline?.closing_month ?? row.closing_month,
      patch.closing_month,
    ));
  }
  if (patch.processing_unit_price !== undefined && patch.processing_unit_price !== row.processing_unit_price) {
    steps.push(createEditStep(
      row.id,
      row.style_number ?? '',
      'processing_unit_price',
      baseline?.processing_unit_price ?? row.processing_unit_price,
      patch.processing_unit_price,
    ));
  }
  return steps;
}

export default function ClosingMonthView() {
  const [data, setData] = useState<DraftStyle[]>([]);
  const [chartUnlockedRows, setChartUnlockedRows] = useState<StyleRecord[]>([]);
  const [chartLockedRows, setChartLockedRows] = useState<StyleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchScope, setSearchScope] = useState<ClosingSearchScope>('local');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const useGlobalSearch = searchScope === 'global' && !!debouncedSearch;
  const [monthRange, setMonthRange] = useState<ClosingMonthRange>(defaultClosingMonthRange);
  const [viewMode, setViewMode] = useState<'card' | 'table'>(loadViewMode);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [bulkTargetMonth, setBulkTargetMonth] = useState<string | undefined>();
  const [historyStyle, setHistoryStyle] = useState<StyleRecord | null>(null);
  const [lockGroup, setLockGroup] = useState<ClosingMonthGroup | null>(null);
  const [locking, setLocking] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [undoOpen, setUndoOpen] = useState(false);
  const [editSteps, setEditSteps] = useState<ClosingEditStep[]>([]);
  const [columnPrefs, setColumnPrefs] = useState<ColumnPreferences>(() =>
    loadViewColumnPreferences(CLOSING_STORAGE_KEY, CLOSING_COLUMNS),
  );
  const baselineRef = useRef<Map<number, StyleBaseline>>(new Map());

  const persistColumnPrefs = useCallback((prefs: ColumnPreferences) => {
    saveViewColumnPreferences(CLOSING_STORAGE_KEY, prefs, CLOSING_COLUMNS);
  }, []);

  const normalizePrefs = useCallback(
    (raw: Partial<ColumnPreferences> | null) => normalizeViewColumnPreferences(raw, CLOSING_COLUMNS),
    [],
  );

  const { onResize, onResizeStop } = useMemo(
    () => createColumnResizeHandlers(CLOSING_DEFAULT_WIDTHS, setColumnPrefs, normalizePrefs, persistColumnPrefs),
    [normalizePrefs, persistColumnPrefs],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const range = normalizeClosingMonthRange(monthRange.startMonth, monthRange.endMonth);
      const csv = closingMonthRangeToCsv(range);

      const tableRes = await getStyles({
        view: 'closing',
        exclude_locked: true,
        closing_month: useGlobalSearch ? undefined : csv,
        search: debouncedSearch || undefined,
      });

      const [unlockedChartRes, lockedChartRes] = await Promise.all([
        getStyles({ view: 'closing', exclude_locked: true, closing_month: csv }),
        getStyles({ view: 'closing', locked_only: true, closing_month: csv }),
      ]);

      const rows = (tableRes.data || []).map((r) => enrichDraft(r));
      setData(rows);
      baselineRef.current = buildBaselineMap(rows);
      setEditSteps([]);
      setSelectedRowKeys([]);
      setChartUnlockedRows((unlockedChartRes.data || []).map(enrichStyleClient));
      setChartLockedRows((lockedChartRes.data || []).map(enrichStyleClient));
    } catch (err) {
      message.error(String(err));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, monthRange, useGlobalSearch]);

  useEffect(() => { void loadData(); }, [loadData]);

  const groups = useMemo(() => groupStylesByClosingMonth(data), [data]);

  const months = useMemo(() => {
    const set = new Set<string>(CLOSING_MONTH_OPTIONS);
    data.forEach((r) => { if (r.closing_month) set.add(r.closing_month); });
    return [...set].sort();
  }, [data]);

  const chartData = useMemo(() => buildClosingChartData(
    groupStylesByClosingMonth(chartUnlockedRows),
    groupStylesByClosingMonth(chartLockedRows),
  ), [chartUnlockedRows, chartLockedRows]);

  const chartYear = monthRange.startMonth.slice(0, 4);

  const averageValue = useMemo(() => {
    if (chartData.length === 0) return 0;
    return chartData.reduce(
      (s, d) => s + d.normal_sales + d.outsource_sales + d.processing_sales,
      0,
    ) / chartData.length;
  }, [chartData]);

  const yearTotalValue = useMemo(() => chartData
    .filter((d) => d.closing_month.startsWith(`${chartYear}-`))
    .reduce((s, d) => s + d.normal_sales + d.outsource_sales + d.processing_sales, 0),
  [chartData, chartYear]);

  const dirtyRows = data.filter((r) => r._dirty);
  const pendingStepCount = editSteps.filter((s) => !s.undone).length;

  const patchRows = useCallback((ids: number[], patch: Partial<DraftStyle>) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const newSteps: ClosingEditStep[] = [];

    setData((prev) => prev.map((row) => {
      if (!idSet.has(row.id)) return row;
      const baseline = baselineRef.current.get(row.id);
      newSteps.push(...collectEditSteps(row, patch, baseline));
      return enrichStyleClient({ ...row, ...patch, _dirty: true }) as DraftStyle;
    }));

    if (newSteps.length > 0) {
      setEditSteps((steps) => [...steps, ...newSteps]);
    }
  }, []);

  const updateRow = (id: number, patch: Partial<DraftStyle>) => {
    patchRows([id], patch);
  };

  const syncDirtyFlags = useCallback((rows: DraftStyle[]) => {
    return rows.map((row) => {
      const baseline = baselineRef.current.get(row.id);
      if (!baseline) return row;
      const dirty = row.closing_month !== baseline.closing_month
        || row.processing_unit_price !== baseline.processing_unit_price;
      return { ...row, _dirty: dirty };
    });
  }, []);

  const handleApply = async () => {
    if (dirtyRows.length === 0) {
      message.info('没有待应用的变更');
      return;
    }
    setApplying(true);
    try {
      await bulkUpdateStyles(
        dirtyRows.map((r) => ({
          id: r.id,
          closing_month: r.closing_month,
          processing_unit_price: r.processing_unit_price,
        })),
      );
      message.success('已应用变更');
      await loadData();
    } catch (err) {
      message.error(String(err));
    } finally {
      setApplying(false);
    }
  };

  const handleUndoSteps = (stepIds: string[]) => {
    const toUndo = editSteps.filter((s) => stepIds.includes(s.id) && !s.undone);
    if (toUndo.length === 0) return;

    setData((prev) => {
      let next = [...prev];
      for (const step of [...toUndo].reverse()) {
        next = next.map((row) => {
          if (row.id !== step.styleId) return row;
          const patch: Partial<DraftStyle> = { [step.field]: step.before };
          return enrichStyleClient({ ...row, ...patch }) as DraftStyle;
        });
      }
      return syncDirtyFlags(next);
    });

    setEditSteps((prev) => prev.map((s) => (
      stepIds.includes(s.id) ? { ...s, undone: true } : s
    )));
    message.success(`已撤销 ${toUndo.length} 项变更`);
    setUndoOpen(false);
  };

  const handleBulkChangeMonth = () => {
    if (!bulkTargetMonth) {
      message.warning('请选择目标关账月');
      return;
    }
    if (selectedRowKeys.length === 0) {
      message.warning('请先勾选要变更的款式');
      return;
    }
    patchRows(selectedRowKeys, { closing_month: bulkTargetMonth });
    message.success(`已将 ${selectedRowKeys.length} 条变更至 ${bulkTargetMonth}，请点击「应用」保存`);
    setSelectedRowKeys([]);
    setBulkTargetMonth(undefined);
  };

  const handleLockConfirm = async () => {
    if (!lockGroup || lockGroup.month === '未分配') return;
    setLocking(true);
    try {
      await lockClosingMonth(lockGroup.month);
      message.success(`${lockGroup.month} 已关账锁定`);
      setLockGroup(null);
      await loadData();
    } catch (err) {
      message.error(String(err));
    } finally {
      setLocking(false);
    }
  };

  const handleViewModeChange = (mode: 'card' | 'table') => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
    setSelectedRowKeys([]);
  };

  const handleMonthRangeChange = (range: ClosingMonthRange) => {
    setMonthRange(normalizeClosingMonthRange(range.startMonth, range.endMonth));
  };

  const refLineLabel = chartData.length > 0
    ? `均值 ${formatMoney(averageValue)}  |  ${chartYear}年度产值 ${formatMoney(yearTotalValue)}`
    : '';

  return (
    <div className="space-y-4 closing-month-view">
      <div className="card-panel">
        <h3 className="text-base font-semibold text-gray-800 mb-4 m-0">月度销售产值</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="closing_month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <RechartsTooltip
              formatter={(v, name, item) => {
                const locked = (item.payload as { locked?: boolean })?.locked;
                const suffix = locked ? '（已关账）' : '';
                return [`${formatMoney(Number(v ?? 0))}${suffix}`, name];
              }}
            />
            <Legend />
            {chartData.length > 0 && (
              <ReferenceLine
                y={averageValue}
                stroke="#f59e0b"
                strokeDasharray="6 4"
                label={{
                  value: refLineLabel,
                  position: 'insideTopRight',
                  fill: '#f59e0b',
                  fontSize: 11,
                }}
              />
            )}
            <Bar dataKey="normal_sales" stackId="sales" name="正常订单">
              {chartData.map((entry) => (
                <Cell
                  key={`normal-${entry.closing_month}`}
                  fill={entry.locked ? CHART_NORMAL_LOCKED : CHART_NORMAL_OPEN}
                />
              ))}
            </Bar>
            <Bar dataKey="outsource_sales" stackId="sales" name="外发">
              {chartData.map((entry) => (
                <Cell
                  key={`out-${entry.closing_month}`}
                  fill={entry.locked ? CHART_OUTSOURCE_LOCKED : CHART_OUTSOURCE_OPEN}
                />
              ))}
            </Bar>
            <Bar dataKey="processing_sales" stackId="sales" name="加工" radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell
                  key={`proc-${entry.closing_month}`}
                  fill={entry.locked ? CHART_PROCESSING_LOCKED : CHART_PROCESSING_OPEN}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="scheduling-toolbar-hint mt-3 mb-0">
          柱状图含已关账月份（更深蓝色）；经销、外发、加工（绿色，需系统设置开启计入）堆叠。虚线为区间月均值，标注含 {chartYear} 年度产值合计。
        </p>
      </div>

      <div className="card-panel">
        <div className="closing-table-toolbar">
          <Space wrap align="end">
            <ClosingMonthRangeFilter value={monthRange} onChange={handleMonthRangeChange} />
            <Space.Compact className="closing-search-compact">
              <Tooltip title={searchScope === 'local'
                ? '在当前关账月区间内搜索'
                : '忽略关账月区间，在全库未关账款式中搜索'}>
                <Select
                  value={searchScope}
                  className="closing-search-scope"
                  popupMatchSelectWidth={false}
                  options={[
                    { value: 'local', label: '局部' },
                    { value: 'global', label: '全局' },
                  ]}
                  onChange={(v: ClosingSearchScope) => setSearchScope(v)}
                />
              </Tooltip>
              <Input.Search
                placeholder={searchScope === 'local' ? '款号 / 品牌 / PO' : '全库搜索款号 / 品牌 / PO'}
                allowClear
                className="closing-search-input"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onSearch={setSearchInput}
              />
            </Space.Compact>
            <Segmented
              value={viewMode}
              options={[
                { label: '卡片', value: 'card' },
                { label: '表格', value: 'table' },
              ]}
              onChange={(v) => handleViewModeChange(v as 'card' | 'table')}
            />
            <Button icon={<FolderOpenOutlined />} onClick={() => setArchiveOpen(true)}>
              查看已关账
            </Button>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadData()}>
              刷新
            </Button>
            <Button
              icon={<UndoOutlined />}
              onClick={() => setUndoOpen(true)}
              disabled={pendingStepCount === 0}
            >
              撤销变更{pendingStepCount > 0 ? ` (${pendingStepCount})` : ''}
            </Button>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              loading={applying}
              onClick={() => void handleApply()}
              disabled={dirtyRows.length === 0}
            >
              应用{dirtyRows.length > 0 ? ` (${dirtyRows.length})` : ''}
            </Button>
            {viewMode === 'table' && (
              <TableColumnSettings
                columns={CLOSING_COLUMNS}
                value={columnPrefs}
                onChange={setColumnPrefs}
                onPersist={persistColumnPrefs}
              />
            )}
          </Space>
        </div>

        {viewMode === 'table' && selectedRowKeys.length > 0 && (
          <div className="closing-bulk-bar">
            <Space wrap align="center">
              <span className="text-sm text-gray-600">已选 {selectedRowKeys.length} 条</span>
              <Select
                placeholder="变更至关账月"
                style={{ minWidth: 140 }}
                value={bulkTargetMonth}
                options={months.map((m) => ({ value: m, label: m }))}
                onChange={setBulkTargetMonth}
                allowClear
              />
              <Button type="primary" onClick={handleBulkChangeMonth}>
                批量变更
              </Button>
              <Button type="link" onClick={() => setSelectedRowKeys([])}>取消选择</Button>
            </Space>
          </div>
        )}

        {viewMode === 'card' ? (
          <ClosingMonthCardView
            groups={groups}
            onLockMonth={setLockGroup}
            onHistory={setHistoryStyle}
          />
        ) : (
          <ClosingMonthTableView
            data={data}
            loading={loading}
            monthOptions={months}
            selectedRowKeys={selectedRowKeys}
            onSelectionChange={setSelectedRowKeys}
            columnPrefs={columnPrefs}
            resizeHandlers={{ onResize, onResizeStop }}
            onUpdate={updateRow}
            onHistory={setHistoryStyle}
          />
        )}
      </div>

      <ClosingMonthLockModal
        open={!!lockGroup}
        group={lockGroup}
        loading={locking}
        onConfirm={() => void handleLockConfirm()}
        onCancel={() => setLockGroup(null)}
      />

      <ClosedClosingArchiveDrawer
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onUnlocked={() => void loadData()}
      />

      <ClosingUndoDrawer
        open={undoOpen}
        steps={editSteps}
        onClose={() => setUndoOpen(false)}
        onUndo={handleUndoSteps}
      />

      <StyleHistoryDrawer
        open={!!historyStyle}
        styleId={historyStyle?.id ?? null}
        styleLabel={historyStyle?.style_number}
        onClose={() => setHistoryStyle(null)}
      />
    </div>
  );
}
