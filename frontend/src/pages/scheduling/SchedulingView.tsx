import { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Input, Space, Button, message, Collapse, Tag } from 'antd';
import {
  HistoryOutlined, ReloadOutlined, ColumnHeightOutlined,
  VerticalAlignMiddleOutlined, CloseOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import TableColumnSettings from '@/components/TableColumnSettings';
import ResizableTableHeader from '@/components/ResizableTableHeader';
import StyleHistoryDrawer from '@/components/scheduling/StyleHistoryDrawer';
import StyleMoveTargetCell from '@/components/scheduling/StyleMoveTargetCell';
import SchedulingPanel from '@/components/scheduling/SchedulingPanel';
import ReadOnlyCell from '@/components/scheduling/ReadOnlyCell';
import {
  StyleDateCell,
  StyleNumberCell,
  StyleTextCell,
} from '@/components/scheduling/StyleInlineCells';
import { useStyleInlineEdit } from '@/hooks/useStyleInlineEdit';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { getStyles, updateStyle } from '@/api/styles';
import type { StyleRecord } from '@/types/style';
import { enrichStyleClient, formatDate, isOfflineAfterShipping } from '@/utils/styleCalculations';
import { useSchedulingSessionSplit } from '@/hooks/useSchedulingSessionSplit';
import {
  SCHEDULING_COLUMNS,
  SCHEDULING_DEFAULT_WIDTHS,
  SCHEDULING_SESSION_COLUMNS,
  SCHEDULING_SESSION_DEFAULT_WIDTHS,
  SCHEDULING_SESSION_STORAGE_KEY,
  SCHEDULING_STORAGE_KEY,
  loadViewColumnPreferences,
  saveViewColumnPreferences,
  normalizeViewColumnPreferences,
} from '@/utils/schedulingColumnPrefs';
import type { ColumnPreferences } from '@/utils/quotationListColumnPrefs';
import {
  applyViewColumnPreferences,
  createColumnResizeHandlers,
  estimateScrollX,
} from '@/utils/viewColumnUtils';
import { useTablePagination } from '@/utils/tablePagination';
import { isAwaitingSchedule } from '@/utils/schedulingRules';
import {
  ALL_COLLAPSE_KEYS,
  EXPAND_ALL_COLLAPSE_KEYS,
  ZONE_COLLAPSE_KEYS,
  collapseKeyForRow,
  collapseLabel,
  formatMaterialText,
  isProductionGroupKey,
  patchForMoveTarget,
  summarizeProductionGroup,
} from '@/utils/schedulingZone';

const SCHEDULING_PAGE_SIZE_KEY = 'scheduling-view-page-size';
const TABLE_HEADER_COMPONENTS = { header: { cell: ResizableTableHeader } };

/** 排单模式中左侧主视图：各组 + 外发，不含待排/下线 */
const MAIN_VIEW_COLLAPSE_KEYS = ALL_COLLAPSE_KEYS.filter(
  (k) => k !== ZONE_COLLAPSE_KEYS.wait && k !== ZONE_COLLAPSE_KEYS.offline,
);

export default function SchedulingView() {
  const [data, setData] = useState<StyleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [activeKeys, setActiveKeys] = useState<string[]>([ZONE_COLLAPSE_KEYS.wait]);
  const [schedulingMode, setSchedulingMode] = useState(false);
  const [columnPrefs, setColumnPrefs] = useState<ColumnPreferences>(() =>
    loadViewColumnPreferences(SCHEDULING_STORAGE_KEY, SCHEDULING_COLUMNS)
  );
  const [sessionColumnPrefs, setSessionColumnPrefs] = useState<ColumnPreferences>(() =>
    loadViewColumnPreferences(SCHEDULING_SESSION_STORAGE_KEY, SCHEDULING_SESSION_COLUMNS)
  );
  const [historyStyle, setHistoryStyle] = useState<StyleRecord | null>(null);
  const { paginationConfig } = useTablePagination(SCHEDULING_PAGE_SIZE_KEY);
  const { savingId, updateLocal, saveField } = useStyleInlineEdit(setData);
  const { panelWidth, resizing, layoutRef, startResize } = useSchedulingSessionSplit(schedulingMode);

  const cellProps = (record: StyleRecord) => ({ record, updateLocal, saveField, savingId });

  const persistColumnPrefs = useCallback((prefs: ColumnPreferences) => {
    saveViewColumnPreferences(SCHEDULING_STORAGE_KEY, prefs, SCHEDULING_COLUMNS);
  }, []);

  const normalizePrefs = useCallback(
    (raw: Partial<ColumnPreferences> | null) => normalizeViewColumnPreferences(raw, SCHEDULING_COLUMNS),
    [],
  );

  const persistSessionColumnPrefs = useCallback((prefs: ColumnPreferences) => {
    saveViewColumnPreferences(SCHEDULING_SESSION_STORAGE_KEY, prefs, SCHEDULING_SESSION_COLUMNS);
  }, []);

  const normalizeSessionPrefs = useCallback(
    (raw: Partial<ColumnPreferences> | null) => normalizeViewColumnPreferences(raw, SCHEDULING_SESSION_COLUMNS),
    [],
  );

  const { onResize, onResizeStop } = useMemo(
    () => createColumnResizeHandlers(SCHEDULING_DEFAULT_WIDTHS, setColumnPrefs, normalizePrefs, persistColumnPrefs),
    [normalizePrefs, persistColumnPrefs],
  );

  const { onResize: onSessionResize, onResizeStop: onSessionResizeStop } = useMemo(
    () => createColumnResizeHandlers(
      SCHEDULING_SESSION_DEFAULT_WIDTHS,
      setSessionColumnPrefs,
      normalizeSessionPrefs,
      persistSessionColumnPrefs,
    ),
    [normalizeSessionPrefs, persistSessionColumnPrefs],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getStyles({
        view: 'scheduling',
        search: debouncedSearch || undefined,
      });
      setData((res.data || []).map(enrichStyleClient));
    } catch (err) {
      message.error(String(err));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleMove = useCallback(async (id: number, patch: Record<string, unknown>) => {
    try {
      await updateStyle(id, patch);
      message.success('区位已更新');
      await loadData();
    } catch (err) {
      message.error(String(err));
    }
  }, [loadData]);

  const handleQuickMove = useCallback(async (record: StyleRecord, target: 'outsource' | 'offline') => {
    await handleMove(record.id, patchForMoveTarget(target));
  }, [handleMove]);

  const enterSchedulingMode = () => {
    setSchedulingMode(true);
  };

  const exitSchedulingMode = () => {
    setSchedulingMode(false);
    setActiveKeys([ZONE_COLLAPSE_KEYS.wait]);
  };

  const baseColumns: ColumnsType<StyleRecord> = useMemo(() => [
    { title: '款号', dataIndex: 'style_number', key: 'style_number', width: 110,
      render: (v: string) => <ReadOnlyCell value={v} /> },
    { title: '品牌', dataIndex: 'brand', key: 'brand', width: 100,
      render: (v: string) => <ReadOnlyCell value={v} /> },
    { title: '款式名称', dataIndex: 'style_name', key: 'style_name', width: 120, ellipsis: true,
      render: (v: string) => <ReadOnlyCell value={v} /> },
    { title: '业务员', dataIndex: 'salesperson', key: 'salesperson', width: 96,
      render: (v: string) => <ReadOnlyCell value={v} /> },
    { title: 'PO号', dataIndex: 'po_number', key: 'po_number', width: 110,
      render: (v: string) => <ReadOnlyCell value={v} /> },
    { title: '订单数量', dataIndex: 'quantity', key: 'quantity', width: 90,
      render: (v: number, record) => (
        <ReadOnlyCell value={record.parent_style_id ? record.quantity : v} />
      ) },
    { title: '要求出货日', dataIndex: 'required_shipping_date', key: 'required_shipping_date', width: 120,
      render: (v: string) => <ReadOnlyCell value={formatDate(v)} placeholder="—" /> },
    { title: '面辅料进度', key: 'fabric_readiness', width: 200,
      render: (_: unknown, record) => (
        <ReadOnlyCell
          value={formatMaterialText(record.fabric_readiness, record.accessories_readiness)}
          multiline
        />
      ) },
    { title: '上线时间', dataIndex: 'online_time', key: 'online_time', width: 120,
      render: (_: unknown, record) => <StyleDateCell field="online_time" {...cellProps(record)} /> },
    { title: '下线时间', dataIndex: 'offline_time', key: 'offline_time', width: 120,
      render: (_: unknown, record) => <StyleDateCell field="offline_time" {...cellProps(record)} /> },
    { title: '天数', dataIndex: 'days', key: 'days', width: 70,
      render: (v: number | null) => (v != null ? v : '—') },
    { title: '排入数量', dataIndex: 'scheduled_output', key: 'scheduled_output', width: 90,
      render: (v: number) => <ReadOnlyCell value={v} /> },
    {
      title: '排单备注', dataIndex: 'scheduling_remarks', key: 'scheduling_remarks', width: 140,
      render: (v: string) => <ReadOnlyCell value={v} multiline />,
    },
    { title: '日均产量', dataIndex: 'avg_daily_output', key: 'avg_daily_output', width: 90,
      render: (_: unknown, record) => <StyleNumberCell field="avg_daily_output" {...cellProps(record)} /> },
  ], [savingId, updateLocal, saveField]);

  const moveTargetColumn: ColumnsType<StyleRecord>[number] = useMemo(() => ({
    title: '调入区位',
    key: 'move_target',
    width: 130,
    ...(!schedulingMode ? { fixed: 'right' as const } : {}),
    render: (_: unknown, record) => (
      <StyleMoveTargetCell record={record} savingId={savingId} onMove={handleMove} />
    ),
  }), [schedulingMode, savingId, handleMove]);

  const outsourceFactoryColumn: ColumnsType<StyleRecord>[number] = useMemo(() => ({
    title: '外发工厂', key: 'outsourced_factory', width: 140, fixed: 'right',
    render: (_: unknown, record) => (
      <StyleTextCell field="outsourced_factory" placeholder="外发工厂" {...cellProps(record)} />
    ),
  }), [savingId, updateLocal, saveField]);

  const outsourcePriceColumn: ColumnsType<StyleRecord>[number] = useMemo(() => ({
    title: '外发价格', key: 'outsourced_price', width: 100, fixed: 'right',
    render: (_: unknown, record) => (
      <StyleNumberCell field="outsourced_price" step={0.01} precision={2} {...cellProps(record)} />
    ),
  }), [savingId, updateLocal, saveField]);

  const buildActionColumn = useCallback((zoneKey: string): ColumnsType<StyleRecord>[number] => ({
    title: '操作',
    key: 'action',
    width: 160,
    ...(!schedulingMode ? { fixed: 'right' as const } : {}),
    render: (_: unknown, record: StyleRecord) => (
      <Space size={4}>
        {zoneKey !== ZONE_COLLAPSE_KEYS.wait && zoneKey !== ZONE_COLLAPSE_KEYS.outsource && (
          <Button type="link" size="small" className="!px-1" onClick={() => handleQuickMove(record, 'outsource')}>
            外发
          </Button>
        )}
        {zoneKey !== ZONE_COLLAPSE_KEYS.wait && (
          <Button type="link" size="small" className="!px-1" onClick={() => handleQuickMove(record, 'offline')}>
            下线
          </Button>
        )}
        <Button type="link" size="small" icon={<HistoryOutlined />} onClick={() => setHistoryStyle(record)} />
      </Space>
    ),
  }), [schedulingMode, handleQuickMove]);

  const getColumnsForZone = useCallback((zoneKey: string) => {
    const tail: ColumnsType<StyleRecord> = [];
    if (zoneKey === ZONE_COLLAPSE_KEYS.outsource) {
      tail.push(outsourceFactoryColumn, outsourcePriceColumn);
    } else if (zoneKey !== ZONE_COLLAPSE_KEYS.wait) {
      tail.push(moveTargetColumn);
    }
    tail.push(buildActionColumn(zoneKey));

    const merged = [...baseColumns, ...tail];
    const prefs = schedulingMode ? sessionColumnPrefs : columnPrefs;
    const resizeOpts = schedulingMode
      ? { onResize: onSessionResize, onResizeStop: onSessionResizeStop }
      : { onResize, onResizeStop };
    return applyViewColumnPreferences(merged, prefs, {
      ...resizeOpts,
      orderedTrailing: schedulingMode,
    });
  }, [
    baseColumns, moveTargetColumn, outsourceFactoryColumn, outsourcePriceColumn,
    buildActionColumn, columnPrefs, sessionColumnPrefs, schedulingMode,
    onResize, onResizeStop, onSessionResize, onSessionResizeStop,
  ]);

  const defaultScrollX = useMemo(
    () => estimateScrollX(getColumnsForZone(ZONE_COLLAPSE_KEYS.wait) as ColumnsType<unknown>),
    [getColumnsForZone],
  );

  const buckets = useMemo(() => {
    const map = new Map<string, StyleRecord[]>();
    for (const key of ALL_COLLAPSE_KEYS) map.set(key, []);
    for (const row of data) {
      const key = collapseKeyForRow(row);
      if (key === ZONE_COLLAPSE_KEYS.wait && !isAwaitingSchedule(row)) continue;
      const list = map.get(key) ?? map.get(ZONE_COLLAPSE_KEYS.wait)!;
      list.push(row);
    }
    return ALL_COLLAPSE_KEYS.map((key) => [key, map.get(key) || []] as const);
  }, [data]);

  const displayBuckets = useMemo(
    () => buckets.filter(([key]) => (
      schedulingMode
        ? MAIN_VIEW_COLLAPSE_KEYS.includes(key)
        : true
    )),
    [buckets, schedulingMode],
  );

  const waitCount = useMemo(
    () => data.filter(isAwaitingSchedule).length,
    [data],
  );

  const renderZoneLabel = (key: string, rows: StyleRecord[]) => {
    const title = collapseLabel(key, rows.length);
    if (!isProductionGroupKey(key) || rows.length === 0) return title;
    const { brands, latestOfflineTime } = summarizeProductionGroup(rows);
    return (
      <div className="scheduling-zone-collapse-label">
        <span className="scheduling-zone-collapse-title">{title}</span>
        <div className="scheduling-zone-collapse-meta">
          {brands.length > 0 && (
            <span className="scheduling-zone-brand-tags">
              {brands.map((brand) => (
                <Tag key={brand} className="scheduling-zone-brand-tag">{brand}</Tag>
              ))}
            </span>
          )}
          {latestOfflineTime && (
            <span className="scheduling-zone-latest-offline">
              最终下线 {formatDate(latestOfflineTime)}
            </span>
          )}
        </div>
      </div>
    );
  };

  const collapseItems = displayBuckets.map(([key, rows]) => ({
    key,
    label: renderZoneLabel(key, rows),
    extra: !schedulingMode && key === ZONE_COLLAPSE_KEYS.wait ? (
      <Button
        type="primary"
        size="small"
        disabled={waitCount === 0}
        onClick={(e) => {
          e.stopPropagation();
          enterSchedulingMode();
        }}
      >
        开始排单
      </Button>
    ) : undefined,
    children: (
      <Table
        className="quotation-list-table scheduling-edit-table"
        rowKey="id"
        size="small"
        tableLayout="fixed"
        components={TABLE_HEADER_COMPONENTS}
        columns={getColumnsForZone(key)}
        dataSource={rows}
        loading={loading}
        scroll={{ x: defaultScrollX }}
        pagination={{
          ...paginationConfig,
          showTotal: (t) => `共 ${t} 款`,
        }}
        rowClassName={(record) => (isOfflineAfterShipping(record) ? 'offline-after-shipping' : '')}
      />
    ),
  }));

  return (
    <div className={`scheduling-view${schedulingMode ? ' is-scheduling-mode' : ''}`}>
      <div className="card-panel mb-4 scheduling-toolbar">
        <Space wrap className="w-full justify-between">
          <Space wrap>
            {schedulingMode && (
              <Button icon={<CloseOutlined />} onClick={exitSchedulingMode}>
                退出排单
              </Button>
            )}
            <Input.Search
              placeholder="搜索款号/品牌"
              allowClear
              style={{ width: 220 }}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onSearch={setSearchInput}
            />
            <Button icon={<ReloadOutlined />} loading={loading} onClick={loadData}>刷新</Button>
            {!schedulingMode && (
              <>
                <Button icon={<ColumnHeightOutlined />} onClick={() => setActiveKeys([...EXPAND_ALL_COLLAPSE_KEYS])}>
                  展开全部
                </Button>
                <Button icon={<VerticalAlignMiddleOutlined />} onClick={() => setActiveKeys([ZONE_COLLAPSE_KEYS.wait])}>
                  折叠全部
                </Button>
              </>
            )}
          </Space>
          {schedulingMode ? (
            <TableColumnSettings
              buttonLabel="排单列设置"
              columns={SCHEDULING_SESSION_COLUMNS}
              value={sessionColumnPrefs}
              onChange={setSessionColumnPrefs}
              onPersist={persistSessionColumnPrefs}
            />
          ) : (
            <TableColumnSettings
              columns={SCHEDULING_COLUMNS}
              value={columnPrefs}
              onChange={(prefs) => {
                saveViewColumnPreferences(SCHEDULING_STORAGE_KEY, prefs, SCHEDULING_COLUMNS);
                setColumnPrefs(loadViewColumnPreferences(SCHEDULING_STORAGE_KEY, SCHEDULING_COLUMNS));
              }}
            />
          )}
        </Space>
        <p className="scheduling-toolbar-hint">
          {schedulingMode
            ? '左侧查看各组已排订单，右侧填写待排单信息并确认排入。'
            : '待排单区点击「开始排单」进入排单；外发订单填写外发工厂与价格；下线时间早于今天（不含今天）自动进入下线区。'}
        </p>
      </div>

      <div
        ref={schedulingMode ? layoutRef : undefined}
        className={
          schedulingMode
            ? `scheduling-session-layout${resizing ? ' is-resizing' : ''}`
            : undefined
        }
      >
        <div className={schedulingMode ? 'scheduling-session-main card-panel' : undefined}>
          <Collapse
            activeKey={activeKeys}
            onChange={(keys) => setActiveKeys(Array.isArray(keys) ? keys : [keys])}
            items={collapseItems}
          />
        </div>

        {schedulingMode && (
          <>
            <div
              className="scheduling-session-resizer"
              role="separator"
              aria-orientation="vertical"
              aria-label="调整排单面板宽度"
              onMouseDown={startResize}
            />
            <div
              className="scheduling-session-panel card-panel"
              style={{ width: panelWidth, flexBasis: panelWidth }}
            >
              <SchedulingPanel data={data} loading={loading} onScheduled={loadData} />
            </div>
          </>
        )}
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
