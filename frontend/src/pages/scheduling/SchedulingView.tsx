import { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Input, Space, Button, message, Collapse } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import TableColumnSettings from '@/components/TableColumnSettings';
import StyleHistoryDrawer from '@/components/scheduling/StyleHistoryDrawer';
import {
  StyleGroupCell,
  StyleDateCell,
  StyleNumberCell,
  StyleTextCell,
  StyleShortOverCell,
  StyleOutsourceSwitch,
} from '@/components/scheduling/StyleInlineCells';
import { useStyleInlineEdit } from '@/hooks/useStyleInlineEdit';
import { getStyles } from '@/api/styles';
import type { StyleRecord } from '@/types/style';
import { enrichStyleClient, formatMoney } from '@/utils/styleCalculations';
import {
  SCHEDULING_COLUMNS,
  SCHEDULING_STORAGE_KEY,
  loadViewColumnPreferences,
  saveViewColumnPreferences,
} from '@/utils/schedulingColumnPrefs';
import type { ColumnPreferences } from '@/utils/quotationListColumnPrefs';
import { applyViewColumnPreferences, estimateScrollX } from '@/utils/viewColumnUtils';

export default function SchedulingView() {
  const [data, setData] = useState<StyleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [columnPrefs, setColumnPrefs] = useState<ColumnPreferences>(() =>
    loadViewColumnPreferences(SCHEDULING_STORAGE_KEY, SCHEDULING_COLUMNS)
  );
  const [historyStyle, setHistoryStyle] = useState<StyleRecord | null>(null);
  const { savingId, updateLocal, saveField } = useStyleInlineEdit(setData);

  const cellProps = (record: StyleRecord) => ({ record, updateLocal, saveField, savingId });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getStyles({ view: 'scheduling', search: search || undefined });
      setData((res.data || []).map(enrichStyleClient));
    } catch (err) {
      message.error(String(err));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { loadData(); }, [loadData]);

  const allColumns: ColumnsType<StyleRecord> = useMemo(() => [
    {
      title: '组别', dataIndex: 'group_name', key: 'group_name', width: 100,
      render: (_: unknown, record) => <StyleGroupCell field="group_name" {...cellProps(record)} />,
    },
    {
      title: '上线时间', dataIndex: 'online_time', key: 'online_time', width: 130,
      render: (_: unknown, record) => <StyleDateCell field="online_time" {...cellProps(record)} />,
    },
    {
      title: '下线时间', dataIndex: 'offline_time', key: 'offline_time', width: 130,
      render: (_: unknown, record) => <StyleDateCell field="offline_time" {...cellProps(record)} />,
    },
    {
      title: '天数', dataIndex: 'days', key: 'days', width: 70,
      render: (v: number | null) => (v != null ? v : '—'),
    },
    {
      title: '排产数量', dataIndex: 'scheduled_output', key: 'scheduled_output', width: 96,
      render: (_: unknown, record) => <StyleNumberCell field="scheduled_output" {...cellProps(record)} />,
    },
    {
      title: '日均产量', dataIndex: 'avg_daily_output', key: 'avg_daily_output', width: 96,
      render: (_: unknown, record) => <StyleNumberCell field="avg_daily_output" {...cellProps(record)} />,
    },
    {
      title: '比例', dataIndex: 'output_ratio', key: 'output_ratio', width: 70,
      render: (v: number | null) => (v != null ? v.toFixed(2) : '—'),
    },
    {
      title: '短溢装', dataIndex: 'short_over_shipment', key: 'short_over_shipment', width: 96,
      render: (_: unknown, record) => <StyleShortOverCell field="short_over_shipment" {...cellProps(record)} />,
    },
    {
      title: '外发', dataIndex: 'is_outsourced', key: 'is_outsourced', width: 72,
      render: (_: unknown, record) => <StyleOutsourceSwitch {...cellProps(record)} />,
    },
    {
      title: '外发工厂', dataIndex: 'outsourced_factory', key: 'outsourced_factory', width: 110,
      render: (_: unknown, record) => (
        <StyleTextCell field="outsourced_factory" placeholder="外发工厂" {...cellProps(record)} />
      ),
    },
    {
      title: '海外跟单', dataIndex: 'overseas_merchandiser', key: 'overseas_merchandiser', width: 100,
      render: (_: unknown, record) => (
        <StyleTextCell field="overseas_merchandiser" placeholder="海外跟单" {...cellProps(record)} />
      ),
    },
    {
      title: '外发价格', dataIndex: 'outsourced_price', key: 'outsourced_price', width: 96,
      render: (_: unknown, record) => (
        <StyleNumberCell field="outsourced_price" step={0.01} precision={2} {...cellProps(record)} />
      ),
    },
    {
      title: '首床时间', dataIndex: 'first_bed_time', key: 'first_bed_time', width: 130,
      render: (_: unknown, record) => <StyleDateCell field="first_bed_time" {...cellProps(record)} />,
    },
    { title: '款号', dataIndex: 'style_number', key: 'style_number', width: 110 },
    { title: '款式名称', dataIndex: 'style_name', key: 'style_name', width: 120, ellipsis: true },
    {
      title: '操作', key: 'action', width: 80, fixed: 'right',
      render: (_: unknown, record: StyleRecord) => (
        <Button type="link" size="small" icon={<HistoryOutlined />} onClick={() => setHistoryStyle(record)} />
      ),
    },
  ], [savingId, updateLocal, saveField]);

  const columns = useMemo(
    () => applyViewColumnPreferences(allColumns, columnPrefs),
    [allColumns, columnPrefs]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, StyleRecord[]>();
    for (const row of data) {
      const key = row.group_name || '未分组';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'zh-CN'));
  }, [data]);

  return (
    <div>
      <div className="card-panel mb-4 scheduling-toolbar">
        <Space wrap className="w-full justify-between">
          <Input.Search placeholder="搜索款号/品牌" allowClear style={{ width: 220 }} onSearch={setSearch} />
          <TableColumnSettings
            columns={SCHEDULING_COLUMNS}
            value={columnPrefs}
            onChange={(prefs) => {
              saveViewColumnPreferences(SCHEDULING_STORAGE_KEY, prefs, SCHEDULING_COLUMNS);
              setColumnPrefs(loadViewColumnPreferences(SCHEDULING_STORAGE_KEY, SCHEDULING_COLUMNS));
            }}
          />
        </Space>
        <p className="scheduling-toolbar-hint">按组别折叠展示，表格内直接编辑排产信息</p>
      </div>

      <Collapse
        defaultActiveKey={grouped.map(([g]) => g)}
        items={grouped.map(([group, rows]) => ({
          key: group,
          label: `${group}（${rows.length} 款）`,
          children: (
            <Table
              className="quotation-list-table scheduling-edit-table"
              rowKey="id"
              size="small"
              columns={columns}
              dataSource={rows}
              loading={loading}
              scroll={{ x: estimateScrollX(columns as ColumnsType<unknown>) }}
              pagination={false}
            />
          ),
        }))}
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
