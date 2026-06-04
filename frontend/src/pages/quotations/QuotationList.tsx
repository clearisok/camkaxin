import { useEffect, useState } from 'react';
import { Table, Button, Input, Select, Tag, Space, message, Popconfirm, Modal, Checkbox } from 'antd';
import { PlusOutlined, CopyOutlined, EditOutlined, DeleteOutlined, ExportOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getQuotations, deleteQuotation, copyQuotation, exportExcel, getTemplates } from '@/api';
import type { Quotation } from '@/types';

const statusMap: Record<string, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  sent: { color: 'processing', text: '已发送' },
  confirmed: { color: 'success', text: '已确认' },
  expired: { color: 'error', text: '已过期' },
};

export default function QuotationList() {
  const navigate = useNavigate();
  const [data, setData] = useState<Quotation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [exportModal, setExportModal] = useState<{ visible: boolean; id?: number }>({ visible: false });
  const [templates, setTemplates] = useState<Array<{ id: number; name: string }>>([]);
  const [exportOptions, setExportOptions] = useState({ templateId: undefined as number | undefined, splitByItem: false });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getQuotations({ search, status, page, pageSize: 20 });
      setData(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      message.error(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [page, status]);

  const handleCopy = async (id: number) => {
    try {
      const res = await copyQuotation(id);
      message.success('复制成功');
      navigate(`/quotations/${res.id}/edit`);
    } catch (err) {
      message.error(String(err));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteQuotation(id);
      message.success('删除成功');
      loadData();
    } catch (err) {
      message.error(String(err));
    }
  };

  const handleExport = async () => {
    if (!exportModal.id) return;
    try {
      const res = await exportExcel(exportModal.id, exportOptions.templateId, exportOptions.splitByItem);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `quotation_${exportModal.id}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      setExportModal({ visible: false });
      message.success('导出成功');
    } catch (err) {
      message.error(String(err));
    }
  };

  const openExport = async (id: number) => {
    try {
      const res = await getTemplates();
      setTemplates(res.data || []);
    } catch { /* ignore */ }
    setExportModal({ visible: true, id });
  };

  const columns = [
    { title: '报价单号', dataIndex: 'quotation_no', key: 'quotation_no', width: 160 },
    { title: '品牌', dataIndex: 'brand_name', key: 'brand_name', width: 120 },
    { title: '业务员', dataIndex: 'agent_name', key: 'agent_name', width: 100 },
    { title: '报价日期', dataIndex: 'quote_date', key: 'quote_date', width: 120 },
    { title: '币种', dataIndex: 'currency', key: 'currency', width: 80 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (s: string) => {
        const info = statusMap[s] || { color: 'default', text: s };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '操作', key: 'action', width: 280, fixed: 'right' as const,
      render: (_: unknown, record: Quotation) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/quotations/${record.id}`)}>查看</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => navigate(`/quotations/${record.id}/edit`)}>编辑</Button>
          <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => handleCopy(record.id!)}>复制</Button>
          <Button type="link" size="small" icon={<ExportOutlined />} onClick={() => openExport(record.id!)}>导出</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id!)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">报价单管理</h1>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => navigate('/quotations/new')}>
          新建报价单
        </Button>
      </div>

      <div className="card-panel mb-4">
        <Space wrap>
          <Input.Search
            placeholder="搜索报价单号/品牌"
            allowClear
            style={{ width: 260 }}
            onSearch={(v) => { setSearch(v); setPage(1); loadData(); }}
          />
          <Select
            placeholder="状态筛选"
            allowClear
            style={{ width: 140 }}
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
            options={Object.entries(statusMap).map(([k, v]) => ({ value: k, label: v.text }))}
          />
        </Space>
      </div>

      <div className="card-panel">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: 1100 }}
          pagination={{
            current: page,
            total,
            pageSize: 20,
            onChange: setPage,
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </div>

      <Modal
        title="导出 Excel"
        open={exportModal.visible}
        onOk={handleExport}
        onCancel={() => setExportModal({ visible: false })}
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm text-gray-600 block mb-1">选择模板</label>
            <Select
              className="w-full"
              placeholder="使用默认模板"
              allowClear
              value={exportOptions.templateId}
              onChange={(v) => setExportOptions({ ...exportOptions, templateId: v })}
              options={templates.map((t) => ({ value: t.id, label: t.name }))}
            />
          </div>
          <Checkbox
            checked={exportOptions.splitByItem}
            onChange={(e) => setExportOptions({ ...exportOptions, splitByItem: e.target.checked })}
          >
            按明细行分 Sheet
          </Checkbox>
        </div>
      </Modal>
    </div>
  );
}
