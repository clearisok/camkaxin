import { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Input, Space, Button, message, Collapse, Tag, Modal } from 'antd';
import {
  HistoryOutlined, ReloadOutlined, ColumnHeightOutlined,
  VerticalAlignMiddleOutlined, CloseOutlined,
  ExperimentOutlined, BellOutlined, ArrowUpOutlined, ArrowDownOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import TableColumnSettings from '@/components/TableColumnSettings';
import ResizableTableHeader from '@/components/ResizableTableHeader';
import StyleHistoryDrawer from '@/components/scheduling/StyleHistoryDrawer';
import StyleMoveTargetCell from '@/components/scheduling/StyleMoveTargetCell';
import OutsourceModal from '@/components/scheduling/OutsourceModal';
import OfflineNotificationDrawer from '@/components/scheduling/OfflineNotificationDrawer';
import SchedulingPanel from '@/components/scheduling/SchedulingPanel';
import ReadOnlyCell from '@/components/scheduling/ReadOnlyCell';
import {
  StyleDateCell,
  StyleNumberCell,
  StyleTextCell,
} from '@/components/scheduling/StyleInlineCells';
import { useStyleInlineEdit } from '@/hooks/useStyleInlineEdit';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  getStyles,
  moveStyle,
  offlineStyle,
  reorderStyle,
  getOfflineNotifications,
  applySandboxOperations,
  previewSandboxScheduling,
  type SandboxOperation,
} from '@/api/styles';
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
import SchedulingExportModal from '@/components/scheduling/SchedulingExportModal';
import { useAuth } from '@/contexts/AuthContext';
import {
  ALL_COLLAPSE_KEYS,
  EXPAND_ALL_COLLAPSE_KEYS,
  ZONE_COLLAPSE_KEYS,
  collapseKeyForRow,
  collapseLabel,
  formatMaterialText,
  isProductionGroupKey,
  inferZone,
  summarizeProductionGroup,
} from '@/utils/schedulingZone';

const SCHEDULING_PAGE_SIZE_KEY = 'scheduling-view-page-size';
const TABLE_HEADER_COMPONENTS = { header: { cell: ResizableTableHeader } };

/** 排单模式中左侧主视图：各组 + 外发，不含待排/下线 */
const MAIN_VIEW_COLLAPSE_KEYS = ALL_COLLAPSE_KEYS.filter(
  (k) => k !== ZONE_COLLAPSE_KEYS.wait && k !== ZONE_COLLAPSE_KEYS.offline,
);

export default function SchedulingView() {
  const { user } = useAuth();
  const [data, setData] = useState<StyleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [schedulingMode, setSchedulingMode] = useState(false);
  const [columnPrefs, setColumnPrefs] = useState<ColumnPreferences>(() =>
    loadViewColumnPreferences(SCHEDULING_STORAGE_KEY, SCHEDULING_COLUMNS)
  );
  const [sessionColumnPrefs, setSessionColumnPrefs] = useState<ColumnPreferences>(() =>
    loadViewColumnPreferences(SCHEDULING_SESSION_STORAGE_KEY, SCHEDULING_SESSION_COLUMNS)
  );
  const [historyStyle, setHistoryStyle] = useState<StyleRecord | null>(null);
  const [sandboxMode, setSandboxMode] = useState(false);
  const [sandboxOps, setSandboxOps] = useState<SandboxOperation[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [outsourceRecord, setOutsourceRecord] = useState<StyleRecord | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [moveSavingId, setMoveSavingId] = useState<number | null>(null);
  const { paginationConfig } = useTablePagination(SCHEDULING_PAGE_SIZE_KEY);
  const { savingId, updateLocal, saveField: baseSaveField } = useStyleInlineEdit(setData);
  const { panelWidth, resizing, layoutRef, startResize } = useSchedulingSessionSplit(schedulingMode);

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

  const saveField = useCallback(async (id: number, patch: Record<string, unknown>) => {
    const record = data.find((r) => r.id === id);
    const zone = record ? inferZone(record) : null;
    const isTimeline = ['online_time', 'offline_time', 'required_days'].some((k) => k in patch);
    await baseSaveField(id, patch);
    if (isTimeline && (zone === 'group' || zone === 'outsource')) {
      await loadData();
    }
  }, [data, baseSaveField, loadData]);

  const cellProps = (record: StyleRecord) => ({ record, updateLocal, saveField, savingId });

  useEffect(() => { loadData(); }, [loadData]);

  const refreshNotificationCount = useCallback(async () => {
    try {
      const res = await getOfflineNotifications();
      setNotificationCount((res.data || []).length);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => { refreshNotificationCount(); }, [refreshNotificationCount, data]);

  const queueSandboxOp = useCallback(async (op: SandboxOperation) => {
    const nextOps = [...sandboxOps, op];
    setLoading(true);
    try {
      const res = await previewSandboxScheduling(nextOps);
      setData((res.data || []).map(enrichStyleClient));
      setSandboxOps(nextOps);
      message.success(`沙箱：已应用「${op.label}」`);
    } catch (err) {
      message.error(String(err));
    } finally {
      setLoading(false);
    }
  }, [sandboxOps]);

  const handleMove = useCallback(async (id: number, target: string) => {
    const record = data.find((r) => r.id === id);
    const label = record ? `${record.style_number} → ${target}` : `移动 ${id}`;
    if (sandboxMode) {
      queueSandboxOp({ type: 'move', id, target, label });
      return;
    }
    setMoveSavingId(id);
    try {
      await moveStyle(id, target);
      message.success('区位已更新');
      await loadData();
    } catch (err) {
      message.error(String(err));
    } finally {
      setMoveSavingId(null);
    }
  }, [data, sandboxMode, queueSandboxOp, loadData]);

  const handleOffline = useCallback(async (record: StyleRecord) => {
    const label = `${record.style_number} 下线`;
    if (sandboxMode) {
      queueSandboxOp({ type: 'offline', id: record.id, label });
      return;
    }
    try {
      await offlineStyle(record.id);
      message.success('已移入下线区');
      await loadData();
    } catch (err) {
      message.error(String(err));
    }
  }, [sandboxMode, queueSandboxOp, loadData]);

  const handleReorder = useCallback(async (record: StyleRecord, direction: 'up' | 'down') => {
    const label = `${record.style_number} ${direction === 'up' ? '上调' : '下调'}`;
    if (sandboxMode) {
      queueSandboxOp({ type: 'reorder', id: record.id, direction, label });
      return;
    }
    try {
      await reorderStyle(record.id, direction);
      message.success(direction === 'up' ? '已上调' : '已下调');
      await loadData();
    } catch (err) {
      message.error(String(err));
    }
  }, [sandboxMode, queueSandboxOp, loadData]);

  const enterSandbox = () => {
    setSandboxMode(true);
    setSandboxOps([]);
    message.info('已进入排单沙箱，操作不会立即写入生产数据');
  };

  const exitSandbox = () => {
    if (sandboxOps.length > 0) {
      Modal.confirm({
        title: '退出沙箱',
        content: '尚有未应用的沙箱操作，确定放弃并退出？',
        onOk: () => {
          setSandboxMode(false);
          setSandboxOps([]);
          void loadData();
        },
      });
      return;
    }
    setSandboxMode(false);
    void loadData();
  };

  const applySandbox = () => {
    if (sandboxOps.length === 0) {
      message.warning('沙箱中暂无待应用操作');
      return;
    }
    Modal.confirm({
      title: '应用排单',
      content: `将 ${sandboxOps.length} 项沙箱操作写入生产数据，是否继续？`,
      onOk: async () => {
        try {
          await applySandboxOperations(sandboxOps);
          message.success('沙箱排单已应用');
          setSandboxOps([]);
          setSandboxMode(false);
          await loadData();
        } catch (err) {
          message.error(String(err));
        }
      },
    });
  };

  const enterSchedulingMode = () => {
    setSchedulingMode(true);
    const first = MAIN_VIEW_COLLAPSE_KEYS.find((key) => {
      const bucket = buckets.find(([k]) => k === key);
      return bucket && bucket[1].length > 0;
    });
    setActiveKeys(first ? [first] : []);
  };

  const exitSchedulingMode = () => {
    setSchedulingMode(false);
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
    { title: '所需天数', dataIndex: 'required_days', key: 'required_days', width: 80,
      render: (v: number | null) => <ReadOnlyCell value={v != null ? v : undefined} placeholder="—" /> },
    { title: '假期天数', dataIndex: 'holiday_days', key: 'holiday_days', width: 80,
      render: (v: number | null) => <ReadOnlyCell value={v != null ? v : undefined} placeholder="—" /> },
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
      <StyleMoveTargetCell record={record} savingId={moveSavingId} onMove={handleMove} />
    ),
  }), [schedulingMode, moveSavingId, handleMove]);

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
    width: 220,
    ...(!schedulingMode ? { fixed: 'right' as const } : {}),
    render: (_: unknown, record: StyleRecord) => (
      <Space size={4} wrap>
        {isProductionGroupKey(zoneKey) && (
          <>
            <Button type="link" size="small" className="!px-1" icon={<ArrowUpOutlined />}
              onClick={() => handleReorder(record, 'up')} />
            <Button type="link" size="small" className="!px-1" icon={<ArrowDownOutlined />}
              onClick={() => handleReorder(record, 'down')} />
          </>
        )}
        {zoneKey !== ZONE_COLLAPSE_KEYS.wait && zoneKey !== ZONE_COLLAPSE_KEYS.outsource && (
          <Button type="link" size="small" className="!px-1" onClick={() => setOutsourceRecord(record)}>
            外发
          </Button>
        )}
        {zoneKey !== ZONE_COLLAPSE_KEYS.wait && inferZone(record) !== 'offline' && (
          <Button type="link" size="small" className="!px-1" onClick={() => handleOffline(record)}>
            下线
          </Button>
        )}
        <Button type="link" size="small" icon={<HistoryOutlined />} onClick={() => setHistoryStyle(record)} />
      </Space>
    ),
  }), [schedulingMode, handleReorder, handleOffline]);

  const getColumnsForZone = useCallback((zoneKey: string) => {
    const timelineEditable = zoneKey !== ZONE_COLLAPSE_KEYS.wait && zoneKey !== ZONE_COLLAPSE_KEYS.offline;
    const cols = baseColumns.map((col) => {
      if (col.key !== 'required_days') return col;
      return {
        ...col,
        render: timelineEditable
          ? (_: unknown, record: StyleRecord) => (
            <StyleNumberCell field="required_days" min={1} precision={0} {...cellProps(record)} />
          )
          : (v: number | null) => <ReadOnlyCell value={v != null ? v : undefined} placeholder="—" />,
      };
    });

    const tail: ColumnsType<StyleRecord> = [];
    if (zoneKey === ZONE_COLLAPSE_KEYS.outsource) {
      tail.push(outsourceFactoryColumn, outsourcePriceColumn);
    } else if (zoneKey !== ZONE_COLLAPSE_KEYS.wait) {
      tail.push(moveTargetColumn);
    }
    tail.push(buildActionColumn(zoneKey));

    const merged = [...cols, ...tail];
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

  useEffect(() => {
    if (debouncedSearch.trim() || schedulingMode) return;
    setActiveKeys((prev) => {
      if (prev.length > 0) return prev;
      if (waitCount > 0) return [ZONE_COLLAPSE_KEYS.wait];
      return [];
    });
  }, [data, waitCount, debouncedSearch, schedulingMode]);

  useEffect(() => {
    if (!debouncedSearch.trim() || schedulingMode) return;
    const keysWithMatches = displayBuckets
      .filter(([, rows]) => rows.length > 0)
      .map(([key]) => key);
    if (keysWithMatches.length > 0) {
      setActiveKeys(keysWithMatches);
    }
  }, [debouncedSearch, displayBuckets, schedulingMode]);

  const renderZoneLabel = (key: string, rows: StyleRecord[]) => {
    const title = collapseLabel(key, rows.length);
    const hasCancelPending = rows.some((r) => r.cancel_pending);
    if (!isProductionGroupKey(key) || rows.length === 0) {
      return (
        <span className="scheduling-zone-collapse-title-wrap">
          {title}
          {hasCancelPending && <Tag color="red" className="ml-2">有取消订单</Tag>}
        </span>
      );
    }
    const { brands, latestOfflineTime } = summarizeProductionGroup(rows);
    return (
      <div className="scheduling-zone-collapse-label">
        <span className="scheduling-zone-collapse-title-wrap">
          <span className="scheduling-zone-collapse-title">{title}</span>
          {hasCancelPending && <Tag color="red" className="ml-2">有取消订单</Tag>}
        </span>
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
        rowClassName={(record) => {
          const classes: string[] = [];
          if (isOfflineAfterShipping(record)) classes.push('offline-after-shipping');
          if (record.cancel_pending) classes.push('scheduling-cancel-pending');
          return classes.join(' ');
        }}
      />
    ),
  }));

  return (
    <div className={`scheduling-view${schedulingMode ? ' is-scheduling-mode' : ''}${sandboxMode ? ' is-sandbox-mode' : ''}`}>
      {sandboxMode && (
        <div className="scheduling-sandbox-banner">
          <Tag color="orange">排单沙箱</Tag>
          <span>当前操作即时预览（已暂存 {sandboxOps.length} 项，未写入生产数据）</span>
          <Space>
            <Button size="small" type="primary" onClick={applySandbox} disabled={sandboxOps.length === 0}>
              应用排单
            </Button>
            <Button size="small" onClick={exitSandbox}>退出沙箱</Button>
          </Space>
        </div>
      )}
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
            <Button
              icon={<FileExcelOutlined />}
              disabled={sandboxMode || data.length === 0}
              onClick={() => {
                if (sandboxMode) {
                  message.warning('排单沙箱模式下不可导出，请先退出沙箱');
                  return;
                }
                setExportOpen(true);
              }}
            >
              导出 Excel
            </Button>
            {!schedulingMode && (
              <>
                <Button icon={<ColumnHeightOutlined />} onClick={() => setActiveKeys([...EXPAND_ALL_COLLAPSE_KEYS])}>
                  展开全部
                </Button>
                <Button icon={<VerticalAlignMiddleOutlined />} onClick={() => setActiveKeys([])}>
                  折叠全部
                </Button>
                <Button
                  type={sandboxMode ? 'primary' : 'default'}
                  icon={<ExperimentOutlined />}
                  onClick={sandboxMode ? exitSandbox : enterSandbox}
                >
                  排单沙箱
                </Button>
                <span className="offline-notify-btn-wrap">
                  {notificationCount > 0 && (
                    <span className="offline-notify-badge" aria-label={`${notificationCount} 条待确认下线`}>
                      {notificationCount > 99 ? '99+' : notificationCount}
                    </span>
                  )}
                  <Button icon={<BellOutlined />} onClick={() => setNotificationOpen(true)}>
                    下线通知
                  </Button>
                </span>
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
            : '待排单区点击「开始排单」进入排单；生产组按工作日链式排期；下线通知处理超期款式。'}
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

      <OutsourceModal
        open={!!outsourceRecord}
        record={outsourceRecord}
        onClose={() => setOutsourceRecord(null)}
        onSuccess={loadData}
        onSubmit={sandboxMode && outsourceRecord ? async (payload) => {
          await queueSandboxOp({
            type: 'outsource',
            id: outsourceRecord.id,
            payload,
            label: `${outsourceRecord.style_number} 外发`,
          });
        } : undefined}
      />

      <OfflineNotificationDrawer
        open={notificationOpen}
        onClose={() => setNotificationOpen(false)}
        onChanged={() => { loadData(); refreshNotificationCount(); }}
      />

      <SchedulingExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        columnPrefs={columnPrefs}
        filteredRows={data}
        searchKeyword={searchInput}
        exportUser={user?.displayName || user?.username || ''}
        sandboxMode={sandboxMode}
      />
    </div>
  );
}
