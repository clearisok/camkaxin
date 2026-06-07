import { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Input, Space, Button, message, DatePicker, InputNumber, Select, Tag, Collapse } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import TableColumnSettings from '@/components/TableColumnSettings';
import StyleHistoryDrawer from '@/components/scheduling/StyleHistoryDrawer';
import { getStyles, updateStyle } from '@/api/styles';
import type { StyleRecord } from '@/types/style';
import { enrichStyleClient, formatDate, formatMoney } from '@/utils/styleCalculations';
import {
  SCHEDULING_COLUMNS,
  SCHEDULING_STORAGE_KEY,
  loadViewColumnPreferences,
  saveViewColumnPreferences,
} from '@/utils/schedulingColumnPrefs';
import type { ColumnPreferences } from '@/utils/quotationListColumnPrefs';
import { applyViewColumnPreferences, estimateScrollX } from '@/utils/viewColumnUtils';

const GROUP_OPTIONS = ['A组', 'B组', 'C组', 'D组'];

export default function SchedulingView() {
  const [data, setData] = useState<StyleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [columnPrefs, setColumnPrefs] = useState<ColumnPreferences>(() =>
    loadViewColumnPreferences(SCHEDULING_STORAGE_KEY, SCHEDULING_COLUMNS)
  );
  const [historyStyle, setHistoryStyle] = useState<StyleRecord | null>(null);

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

  const patchStyle = async (id: number, patch: Record<string, unknown>) => {
    setSavingId(id);
    try {
      const res = await updateStyle(id, patch);
      setData((prev) => prev.map((row) => (row.id === id ? enrichStyleClient(res.data) : row)));
    } catch (err) {
      message.error(String(err));
    } finally {
      setSavingId(null);
    }
  };

  const updateLocal = (id: number, patch: Partial<StyleRecord>) => {
    setData((prev) => prev.map((row) => (row.id === id ? enrichStyleClient({ ...row, ...patch }) : row)));
  };

  const allColumns: ColumnsType<StyleRecord> = useMemo(() => [
    {
      title: '组别', dataIndex: 'group_name', key: 'group_name', width: 100,
      render: (v: string, record) => (
        <Select
          size="small"
          className="w-full"
          value={v || undefined}
          options={GROUP_OPTIONS.map((g) => ({ value: g, label: g }))}
          onChange={(val) => {
            updateLocal(record.id, { group_name: val });
            patchStyle(record.id, { group_name: val });
          }}
          loading={savingId === record.id}
        />
      ),
    },
    {
      title: '上线时间', dataIndex: 'online_time', key: 'online_time', width: 130,
      render: (v: string, record) => (
        <DatePicker
          size="small"
          className="w-full"
          value={v ? dayjs(v) : undefined}
          onChange={(d) => {
            const val = d ? d.format('YYYY-MM-DD') : undefined;
            updateLocal(record.id, { online_time: val });
            patchStyle(record.id, { online_time: val ?? null });
          }}
        />
      ),
    },
    {
      title: '下线时间', dataIndex: 'offline_time', key: 'offline_time', width: 130,
      render: (v: string, record) => (
        <DatePicker
          size="small"
          className="w-full"
          value={v ? dayjs(v) : undefined}
          onChange={(d) => {
            const val = d ? d.format('YYYY-MM-DD') : undefined;
            updateLocal(record.id, { offline_time: val });
            patchStyle(record.id, { offline_time: val ?? null });
          }}
        />
      ),
    },
    {
      title: '天数', dataIndex: 'days', key: 'days', width: 70,
      render: (v: number | null) => (v != null ? v : '—'),
    },
    {
      title: '排产数量', dataIndex: 'scheduled_output', key: 'scheduled_output', width: 90,
      render: (v: number, record) => (
        <InputNumber
          size="small"
          className="w-full"
          value={v}
          min={0}
          onChange={(val) => {
            updateLocal(record.id, { scheduled_output: val ?? undefined });
          }}
          onBlur={() => patchStyle(record.id, { scheduled_output: record.scheduled_output ?? null })}
        />
      ),
    },
    {
      title: '日均产量', dataIndex: 'avg_daily_output', key: 'avg_daily_output', width: 90,
      render: (v: number, record) => (
        <InputNumber
          size="small"
          className="w-full"
          value={v}
          min={0}
          onChange={(val) => updateLocal(record.id, { avg_daily_output: val ?? undefined })}
          onBlur={() => patchStyle(record.id, { avg_daily_output: record.avg_daily_output ?? null })}
        />
      ),
    },
    {
      title: '比例', dataIndex: 'output_ratio', key: 'output_ratio', width: 70,
      render: (v: number | null) => (v != null ? v.toFixed(2) : '—'),
    },
    { title: '短溢装', dataIndex: 'short_over_shipment', key: 'short_over_shipment', width: 90 },
    {
      title: '外发', dataIndex: 'is_outsourced', key: 'is_outsourced', width: 70,
      render: (v: boolean) => (v ? <Tag color="orange">是</Tag> : <Tag>否</Tag>),
    },
    { title: '外发工厂', dataIndex: 'outsourced_factory', key: 'outsourced_factory', width: 110, ellipsis: true },
    { title: '海外跟单', dataIndex: 'overseas_merchandiser', key: 'overseas_merchandiser', width: 100 },
    {
      title: '外发价格', dataIndex: 'outsourced_price', key: 'outsourced_price', width: 90,
      render: (v: number) => formatMoney(v),
    },
    {
      title: '首床时间', dataIndex: 'first_bed_time', key: 'first_bed_time', width: 130,
      render: (v: string, record) => (
        <DatePicker
          size="small"
          className="w-full"
          value={v ? dayjs(v) : undefined}
          onChange={(d) => {
            const val = d ? d.format('YYYY-MM-DD') : undefined;
            updateLocal(record.id, { first_bed_time: val });
            patchStyle(record.id, { first_bed_time: val ?? null });
          }}
        />
      ),
    },
    { title: '款号', dataIndex: 'style_number', key: 'style_number', width: 110 },
    { title: '款式名称', dataIndex: 'style_name', key: 'style_name', width: 120, ellipsis: true },
    {
      title: '操作', key: 'action', width: 80, fixed: 'right',
      render: (_: unknown, record: StyleRecord) => (
        <Button type="link" size="small" icon={<HistoryOutlined />} onClick={() => setHistoryStyle(record)} />
      ),
    },
  ], [savingId]);

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
      <div className="card-panel mb-4">
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
      </div>

      <Collapse
        defaultActiveKey={grouped.map(([g]) => g)}
        items={grouped.map(([group, rows]) => ({
          key: group,
          label: `${group}（${rows.length} 款）`,
          children: (
            <Table
              className="quotation-list-table"
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
