import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, DatePicker, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, message,
} from 'antd';
import { PlusOutlined, SyncOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  createCalendarException,
  deleteCalendarException,
  getCalendarExceptions,
  getCalendarRules,
  syncCambodiaHolidays,
  updateCalendarException,
  type CalendarException,
  type CalendarDayType,
} from '@/api';
import PageHeader from '@/components/PageHeader';
import ResizableTableHeader from '@/components/ResizableTableHeader';
import { beijingNow } from '@/utils/beijingTime';
import { clampColumnWidth } from '@/utils/quotationListColumnPrefs';
import { estimateScrollX } from '@/utils/viewColumnUtils';

const { RangePicker } = DatePicker;

const DAY_TYPE_OPTIONS = [
  { value: 'holiday', label: '休息日（放假）' },
  { value: 'workday', label: '补班（上班）' },
];

const STORAGE_KEY = 'holiday-manage-column-widths';

const DEFAULT_WIDTHS: Record<string, number> = {
  period: 220,
  day_count: 72,
  day_type: 96,
  name: 200,
  source: 108,
  effective: 88,
  action: 140,
};

const TABLE_HEADER_COMPONENTS = { header: { cell: ResizableTableHeader } };

function loadWidths(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WIDTHS };
    return { ...DEFAULT_WIDTHS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_WIDTHS };
  }
}

function saveWidths(widths: Record<string, number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
}

function dayTypeTag(type: CalendarDayType) {
  return type === 'holiday'
    ? <Tag color="orange">休息</Tag>
    : <Tag color="blue">补班</Tag>;
}

function sourceLabel(source: string) {
  return source === 'cambodia' ? '柬埔寨法定' : '手工';
}

function formatPeriod(record: CalendarException) {
  if (record.period_label) return record.period_label;
  return record.start_date === record.end_date
    ? record.start_date
    : `${record.start_date} ~ ${record.end_date}`;
}

export default function HolidayManage() {
  const [year, setYear] = useState(() => beijingNow().year());
  const [data, setData] = useState<CalendarException[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [rules, setRules] = useState<{ base_rule?: string; cambodia_years_available?: number[] }>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarException | null>(null);
  const [widths, setWidths] = useState(loadWidths);
  const [form] = Form.useForm();

  const yearOptions = useMemo(() => {
    const available = rules.cambodia_years_available ?? [];
    const set = new Set([year, ...available, beijingNow().year()]);
    return [...set].sort((a, b) => a - b).map((y) => ({ value: y, label: `${y} 年` }));
  }, [rules.cambodia_years_available, year]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, rulesRes] = await Promise.all([
        getCalendarExceptions(year, true),
        getCalendarRules(),
      ]);
      setData(listRes.data || []);
      setRules(rulesRes.data || {});
    } catch (err) {
      message.error(String(err));
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const handleColumnResize = useCallback((key: string) => (w: number) => {
    setWidths((prev) => ({
      ...prev,
      [key]: clampColumnWidth(w, prev[key] ?? DEFAULT_WIDTHS[key] ?? 120),
    }));
  }, []);

  const handleColumnResizeStop = useCallback((key: string) => (w: number) => {
    setWidths((prev) => {
      const next = {
        ...prev,
        [key]: clampColumnWidth(w, prev[key] ?? DEFAULT_WIDTHS[key] ?? 120),
      };
      saveWidths(next);
      return next;
    });
  }, []);

  const openCreate = (dayType: CalendarDayType) => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ day_type: dayType });
    setModalOpen(true);
  };

  const openEdit = (record: CalendarException) => {
    setEditing(record);
    form.setFieldsValue({
      date_range: [dayjs(record.start_date), dayjs(record.end_date)],
      day_type: record.day_type,
      name: record.name ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    const range = values.date_range as [dayjs.Dayjs, dayjs.Dayjs];
    const payload = {
      start_date: range[0].format('YYYY-MM-DD'),
      end_date: range[1].format('YYYY-MM-DD'),
      day_type: values.day_type as CalendarDayType,
      name: values.name?.trim() || undefined,
    };
    try {
      if (editing) {
        await updateCalendarException(editing.id, payload);
        message.success('已更新，生产组排期已按最新日历刷新');
      } else {
        await createCalendarException(payload);
        message.success('已添加，生产组排期已按最新日历刷新');
      }
      setModalOpen(false);
      form.resetFields();
      setEditing(null);
      load();
    } catch (err) {
      message.error(String(err));
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncCambodiaHolidays([year]);
      message.success(res.message ? `${res.message}，生产组排期已刷新` : '同步完成，生产组排期已刷新');
      load();
    } catch (err) {
      message.error(String(err));
    } finally {
      setSyncing(false);
    }
  };

  const columns: ColumnsType<CalendarException> = useMemo(() => [
    {
      title: '时间段',
      key: 'period',
      width: widths.period,
      onHeaderCell: () => ({
        width: widths.period,
        onResize: handleColumnResize('period'),
        onResizeStop: handleColumnResizeStop('period'),
      }),
      sorter: (a, b) => a.start_date.localeCompare(b.start_date),
      render: (_: unknown, record) => (
        <div>
          <div>{formatPeriod(record)}</div>
          {record.start_date !== record.end_date && (
            <div className="text-xs text-gray-400">
              {record.weekday_start} → {record.weekday_end}
            </div>
          )}
        </div>
      ),
    },
    {
      title: '天数',
      key: 'day_count',
      width: widths.day_count,
      onHeaderCell: () => ({
        width: widths.day_count,
        onResize: handleColumnResize('day_count'),
        onResizeStop: handleColumnResizeStop('day_count'),
      }),
      render: (_: unknown, record) => record.day_count ?? 1,
    },
    {
      title: '类型',
      dataIndex: 'day_type',
      key: 'day_type',
      width: widths.day_type,
      onHeaderCell: () => ({
        width: widths.day_type,
        onResize: handleColumnResize('day_type'),
        onResizeStop: handleColumnResizeStop('day_type'),
      }),
      render: (v: CalendarDayType) => dayTypeTag(v),
    },
    {
      title: '说明',
      dataIndex: 'name',
      key: 'name',
      width: widths.name,
      ellipsis: true,
      onHeaderCell: () => ({
        width: widths.name,
        onResize: handleColumnResize('name'),
        onResizeStop: handleColumnResizeStop('name'),
      }),
      render: (v: string | null) => v || '—',
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: widths.source,
      onHeaderCell: () => ({
        width: widths.source,
        onResize: handleColumnResize('source'),
        onResizeStop: handleColumnResizeStop('source'),
      }),
      render: (v: string) => sourceLabel(v),
    },
    {
      title: '生效',
      key: 'effective',
      width: widths.effective,
      onHeaderCell: () => ({
        width: widths.effective,
        onResize: handleColumnResize('effective'),
        onResizeStop: handleColumnResizeStop('effective'),
      }),
      render: (_: unknown, record) => (
        record.day_type === 'workday'
          ? <Tag color="green">上班</Tag>
          : <Tag>休息</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: widths.action,
      fixed: 'right',
      onHeaderCell: () => ({
        width: widths.action,
        onResize: handleColumnResize('action'),
        onResizeStop: handleColumnResizeStop('action'),
      }),
      render: (_: unknown, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => openEdit(record)}>编辑</Button>
          <Popconfirm
            title="确定删除此时间段？"
            onConfirm={async () => {
              await deleteCalendarException(record.id);
              message.success('已删除，生产组排期已按最新日历刷新');
              load();
            }}
          >
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ], [widths, handleColumnResize, handleColumnResizeStop]);

  const scrollX = useMemo(() => estimateScrollX(columns), [columns]);

  return (
    <div className="page-container">
      <PageHeader
        title="假期管理"
        description="默认周一至周六上班、周日休息；每条记录为一个时间段，可维护柬埔寨法定假期与补班"
        extra={(
          <Space wrap>
            <Select
              value={year}
              options={yearOptions}
              onChange={setYear}
              style={{ width: 110 }}
            />
            <Button icon={<SyncOutlined />} loading={syncing} onClick={handleSync}>
              同步柬埔寨假期
            </Button>
            <Button icon={<PlusOutlined />} onClick={() => openCreate('holiday')}>
              新增休息段
            </Button>
            <Button icon={<PlusOutlined />} onClick={() => openCreate('workday')}>
              新增补班段
            </Button>
          </Space>
        )}
      />

      <Alert
        type="info"
        showIcon
        className="mb-4"
        message={rules.base_rule ?? '周一至周六为工作日，周日休息'}
        description="每条记录表示一段连续日期。「休息段」覆盖默认上班日；「补班段」覆盖默认休息日。同步柬埔寨假期时会将连续同名假日合并为一条。列宽可拖拽表头调整。"
      />

      <div className="card-panel">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: scrollX }}
          components={TABLE_HEADER_COMPONENTS}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
          locale={{ emptyText: '暂无例外时间段，可同步柬埔寨假期或手工添加' }}
        />
      </div>

      <Modal
        title={editing ? '编辑时间段' : '新增时间段'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}
        onOk={handleSave}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="date_range"
            label="时间段"
            rules={[{ required: true, message: '请选择起止日期' }]}
          >
            <RangePicker className="w-full" allowEmpty={[false, false]} />
          </Form.Item>
          <Form.Item
            name="day_type"
            label="类型"
            rules={[{ required: true, message: '请选择类型' }]}
          >
            <Select options={DAY_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="name" label="说明">
            <Input placeholder="如：柬新年、周日补班" maxLength={200} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
