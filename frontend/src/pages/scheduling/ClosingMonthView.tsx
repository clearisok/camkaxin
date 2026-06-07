import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Table, Space, Button, message, Select, InputNumber,
} from 'antd';
import { HistoryOutlined, SaveOutlined } from '@ant-design/icons';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { ColumnsType } from 'antd/es/table';
import StyleHistoryDrawer from '@/components/scheduling/StyleHistoryDrawer';
import { getStyles, bulkUpdateStyles } from '@/api/styles';
import type { StyleRecord } from '@/types/style';
import { CLOSING_MONTH_OPTIONS } from '@/types/style';
import { enrichStyleClient, formatMoney } from '@/utils/styleCalculations';

interface DraftStyle extends StyleRecord {
  _dirty?: boolean;
}

function enrichDraft(row: StyleRecord): DraftStyle {
  return { ...enrichStyleClient(row), _dirty: false };
}

function DraggableStyleChip({ style }: { style: DraftStyle }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `style-${style.id}`,
    data: { styleId: style.id },
  });
  const style_transform = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style_transform}
      className={`text-xs px-2 py-1 rounded bg-blue-50 border border-blue-200 cursor-grab truncate max-w-[120px] ${
        isDragging ? 'opacity-50 shadow-md' : ''
      }`}
      title={`${style.style_number} · ${formatMoney(style.sales_output_value)}`}
    >
      {style.style_number}
    </div>
  );
}

function MonthDropZone({ month, styles }: { month: string; styles: DraftStyle[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `month-${month}`, data: { month } });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[100px] border rounded-lg p-2 min-h-[100px] ${
        isOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="text-xs font-medium text-gray-500 mb-2 text-center">{month}</div>
      <div className="flex flex-col gap-1">
        {styles.map((s) => (
          <DraggableStyleChip key={s.id} style={s} />
        ))}
      </div>
    </div>
  );
}

export default function ClosingMonthView() {
  const [data, setData] = useState<DraftStyle[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [historyStyle, setHistoryStyle] = useState<StyleRecord | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getStyles({ view: 'closing' });
      setData((res.data || []).map((r) => enrichDraft(r)));
    } catch (err) {
      message.error(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const months = useMemo(() => {
    const set = new Set<string>(CLOSING_MONTH_OPTIONS);
    data.forEach((r) => { if (r.closing_month) set.add(r.closing_month); });
    return [...set].sort();
  }, [data]);

  const chartData = useMemo(() => {
    const map = new Map<string, { closing_month: string; total_sales_output_value: number; count: number }>();
    for (const m of months) {
      map.set(m, { closing_month: m, total_sales_output_value: 0, count: 0 });
    }
    for (const row of data) {
      const m = row.closing_month || '未分配';
      if (!map.has(m)) map.set(m, { closing_month: m, total_sales_output_value: 0, count: 0 });
      const item = map.get(m)!;
      item.total_sales_output_value += row.sales_output_value ?? 0;
      item.count += 1;
    }
    return [...map.values()].filter((x) => x.closing_month !== '未分配' || x.count > 0);
  }, [data, months]);

  const averageValue = useMemo(() => {
    const valid = chartData.filter((d) => d.count > 0);
    if (valid.length === 0) return 0;
    return valid.reduce((s, d) => s + d.total_sales_output_value, 0) / valid.length;
  }, [chartData]);

  const stylesByMonth = useMemo(() => {
    const map = new Map<string, DraftStyle[]>();
    for (const m of months) map.set(m, []);
    for (const row of data) {
      const m = row.closing_month || months[0];
      if (!map.has(m)) map.set(m, []);
      map.get(m)!.push(row);
    }
    return map;
  }, [data, months]);

  const updateRow = (id: number, patch: Partial<DraftStyle>) => {
    setData((prev) => prev.map((row) => {
      if (row.id !== id) return row;
      return enrichStyleClient({ ...row, ...patch, _dirty: true }) as DraftStyle;
    }));
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const styleId = event.active.data.current?.styleId as number | undefined;
    const targetMonth = event.over?.data.current?.month as string | undefined;
    if (!styleId || !targetMonth) return;
    updateRow(styleId, { closing_month: targetMonth });
  };

  const dirtyRows = data.filter((r) => r._dirty);

  const handleSaveAll = async () => {
    if (dirtyRows.length === 0) {
      message.info('没有待保存的变更');
      return;
    }
    setSaving(true);
    try {
      await bulkUpdateStyles(
        dirtyRows.map((r) => ({
          id: r.id,
          closing_month: r.closing_month,
          processing_unit_price: r.processing_unit_price,
        }))
      );
      message.success('保存成功');
      loadData();
    } catch (err) {
      message.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<DraftStyle> = [
    { title: '款号', dataIndex: 'style_number', key: 'style_number', width: 110 },
    { title: '款式名称', dataIndex: 'style_name', key: 'style_name', width: 140, ellipsis: true },
    {
      title: '关账月份', dataIndex: 'closing_month', key: 'closing_month', width: 130,
      render: (v: string, record) => (
        <Select
          size="small"
          className="w-full"
          value={v}
          options={months.map((m) => ({ value: m, label: m }))}
          onChange={(val) => updateRow(record.id, { closing_month: val })}
        />
      ),
    },
    {
      title: '加工单价', dataIndex: 'processing_unit_price', key: 'processing_unit_price', width: 120,
      render: (v: number, record) => (
        <InputNumber
          size="small"
          className="w-full"
          value={v}
          min={0}
          step={0.01}
          precision={2}
          onChange={(val) => updateRow(record.id, { processing_unit_price: val ?? undefined })}
        />
      ),
    },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80 },
    {
      title: '销售单价', dataIndex: 'sales_price', key: 'sales_price', width: 100,
      render: (v: number) => formatMoney(v),
    },
    {
      title: '销售产值', dataIndex: 'sales_output_value', key: 'sales_output_value', width: 110,
      render: (v: number) => formatMoney(v),
    },
    {
      title: '操作', key: 'action', width: 70, fixed: 'right',
      render: (_: unknown, record: StyleRecord) => (
        <Button type="link" size="small" icon={<HistoryOutlined />} onClick={() => setHistoryStyle(record)} />
      ),
    },
  ];

  const activeStyle = activeDragId
    ? data.find((s) => `style-${s.id}` === activeDragId)
    : null;

  return (
    <div className="space-y-4">
      <div className="card-panel">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-semibold text-gray-800">月度销售产值</h3>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSaveAll}
            disabled={dirtyRows.length === 0}
          >
            保存全部变更 {dirtyRows.length > 0 && `(${dirtyRows.length})`}
          </Button>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="closing_month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => formatMoney(Number(v ?? 0))} />
            <ReferenceLine
              y={averageValue}
              stroke="#f59e0b"
              strokeDasharray="6 4"
              label={{ value: `均值 ${formatMoney(averageValue)}`, position: 'insideTopRight', fill: '#f59e0b', fontSize: 12 }}
            />
            <Bar dataKey="total_sales_output_value" fill="#2563eb" radius={[4, 4, 0, 0]} name="销售产值" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card-panel">
        <h3 className="text-base font-semibold text-gray-800 mb-3">拖拽调整关账月份</h3>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-2 overflow-x-auto pb-2">
            {months.map((month) => (
              <MonthDropZone key={month} month={month} styles={stylesByMonth.get(month) || []} />
            ))}
          </div>
          <DragOverlay>
            {activeStyle ? (
              <div className="text-xs px-2 py-1 rounded bg-blue-100 border border-blue-300 shadow-lg">
                {activeStyle.style_number}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <div className="card-panel">
        <Table
          className="quotation-list-table"
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: 900 }}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
          rowClassName={(record) => (record._dirty ? 'row-dirty' : '')}
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
