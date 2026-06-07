import { useEffect, useState } from 'react';
import { Card, InputNumber, Button, Upload, Table, message, Popconfirm, Divider } from 'antd';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import { getSettings, updateExchangeRate, getTemplates, uploadTemplate, deleteTemplate } from '@/api';
import PageHeader from '@/components/PageHeader';

export default function SystemSettings() {
  const [rate, setRate] = useState(6.8);
  const [templates, setTemplates] = useState<Array<{ id: number; name: string; is_default: boolean; created_at: string }>>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [s, t] = await Promise.all([getSettings(), getTemplates()]);
      setRate(Math.round(parseFloat(s.data?.usd_to_rmb_rate || '6.8') * 100) / 100);
      setTemplates(t.data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => { load(); }, []);

  const saveRate = async () => {
    setSaving(true);
    try {
      await updateExchangeRate(rate);
      message.success('汇率已更新');
    } catch (err) {
      message.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleTemplateUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name);
    try {
      await uploadTemplate(formData);
      message.success('模板上传成功');
      load();
    } catch (err) {
      message.error(String(err));
    }
    return false;
  };

  const templateColumns = [
    { title: '模板名称', dataIndex: 'name' },
    {
      title: '默认', dataIndex: 'is_default', width: 80,
      render: (v: boolean) => v ? '是' : '否',
    },
    { title: '上传时间', dataIndex: 'created_at', width: 180,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作', width: 100,
      render: (_: unknown, record: { id: number }) => (
        <Popconfirm title="确定删除？" onConfirm={async () => { await deleteTemplate(record.id); message.success('已删除'); load(); }}>
          <Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="page-container">
      <PageHeader title="系统设置" />

      <Card title="全局汇率设置" className="card-panel mb-6">
        <p className="text-gray-500 text-sm mb-4">USD to RMB 汇率，保留 2 位小数</p>
        <div className="flex items-center gap-4">
          <InputNumber
            value={rate}
            onChange={(v) => setRate(Math.round((v || 6.8) * 100) / 100)}
            min={0}
            step={0.01}
            precision={2}
            style={{ width: 200 }}
            addonBefore="1 USD ="
            addonAfter="RMB"
          />
          <Button type="primary" loading={saving} onClick={saveRate}>保存汇率</Button>
        </div>
      </Card>

      <Card title="Excel 导出模板" className="card-panel">
        <p className="text-gray-500 text-sm mb-4">
          上传 Excel 模板，使用 <code className="bg-gray-100 px-1 rounded">${'{字段名}'}</code> 作为占位符。
          动态表格区域使用 <code className="bg-gray-100 px-1 rounded">{'{{FabricTable}}'}</code>、
          <code className="bg-gray-100 px-1 rounded">{'{{AccessoryTable}}'}</code>、
          <code className="bg-gray-100 px-1 rounded">{'{{QuantityTierTable}}'}</code> 标记。
        </p>

        <Upload beforeUpload={handleTemplateUpload} showUploadList={false} accept=".xlsx,.xls">
          <Button icon={<UploadOutlined />}>上传模板</Button>
        </Upload>

        <Divider />

        <Table rowKey="id" columns={templateColumns} dataSource={templates} pagination={false} size="small" />

        <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
          <p className="font-medium mb-2">支持的占位符：</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {['报价单号', '品牌', '业务员', '款号', '版本标签', '交期', '数量', '工价USD', '成本小计', '最终报价', '款式图'].map((p) => (
              <code key={p} className="bg-white px-2 py-1 rounded border">${'{'}{p}{'}'}</code>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
