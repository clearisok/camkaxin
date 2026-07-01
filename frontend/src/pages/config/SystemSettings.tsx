import { useEffect, useState } from 'react';
import { Card, InputNumber, Button, Upload, Table, message, Popconfirm, Divider, Switch } from 'antd';
import { UploadOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  getSettings,
  updateExchangeRate,
  updateClosingIncludeProcessing,
  getTemplates,
  uploadTemplate,
  deleteTemplate,
  getEarlyWarningExportTemplatesAdmin,
  deleteEarlyWarningExportTemplate,
  getSchedulingExportTemplatesAdmin,
  deleteSchedulingExportTemplate,
} from '@/api';
import PageHeader from '@/components/PageHeader';
import EarlyWarningExportTemplateModal from '@/components/scheduling/EarlyWarningExportTemplateModal';
import type { EarlyWarningExportTemplate } from '@/types/earlyWarningExportTemplate';
import { formatDateTimeBeijing } from '@/utils/beijingTime';

export default function SystemSettings() {
  const [rate, setRate] = useState(6.8);
  const [closingIncludeProcessing, setClosingIncludeProcessing] = useState(false);
  const [templates, setTemplates] = useState<Array<{ id: number; name: string; is_default: boolean; created_at: string }>>([]);
  const [ewTemplates, setEwTemplates] = useState<EarlyWarningExportTemplate[]>([]);
  const [schedTemplates, setSchedTemplates] = useState<EarlyWarningExportTemplate[]>([]);
  const [ewModalOpen, setEwModalOpen] = useState(false);
  const [schedModalOpen, setSchedModalOpen] = useState(false);
  const [editingEwTemplate, setEditingEwTemplate] = useState<EarlyWarningExportTemplate | null>(null);
  const [editingSchedTemplate, setEditingSchedTemplate] = useState<EarlyWarningExportTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [s, t, ew, sched] = await Promise.all([
        getSettings(),
        getTemplates(),
        getEarlyWarningExportTemplatesAdmin(),
        getSchedulingExportTemplatesAdmin(),
      ]);
      setRate(Math.round(parseFloat(s.data?.usd_to_rmb_rate || '6.8') * 100) / 100);
      setClosingIncludeProcessing(s.data?.closing_include_processing === 'true');
      setTemplates(t.data || []);
      setEwTemplates(ew.data || []);
      setSchedTemplates(sched.data || []);
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

  const saveClosingIncludeProcessing = async (checked: boolean) => {
    setClosingIncludeProcessing(checked);
    try {
      await updateClosingIncludeProcessing(checked);
      message.success(checked ? '已开启关账计入加工' : '已关闭关账计入加工');
    } catch (err) {
      message.error(String(err));
      setClosingIncludeProcessing(!checked);
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
      render: (v: string) => formatDateTimeBeijing(v),
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

  const ewTemplateColumns = [
    { title: '模板名称', dataIndex: 'name' },
    {
      title: '列数',
      width: 72,
      render: (_: unknown, record: EarlyWarningExportTemplate) => record.config.columns.length,
    },
    {
      title: '默认', dataIndex: 'is_default', width: 80,
      render: (v: boolean) => v ? '是' : '否',
    },
    {
      title: '更新时间', dataIndex: 'updated_at', width: 180,
      render: (v: string) => formatDateTimeBeijing(v),
    },
    {
      title: '操作', width: 140,
      render: (_: unknown, record: EarlyWarningExportTemplate) => (
        <span>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => { setEditingEwTemplate(record); setEwModalOpen(true); }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除？"
            onConfirm={async () => {
              await deleteEarlyWarningExportTemplate(record.id);
              message.success('已删除');
              load();
            }}
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </span>
      ),
    },
  ];

  const schedTemplateColumns = [
    { title: '模板名称', dataIndex: 'name' },
    {
      title: '列数',
      width: 72,
      render: (_: unknown, record: EarlyWarningExportTemplate) => record.config.columns.length,
    },
    {
      title: '默认', dataIndex: 'is_default', width: 80,
      render: (v: boolean) => v ? '是' : '否',
    },
    {
      title: '更新时间', dataIndex: 'updated_at', width: 180,
      render: (v: string) => formatDateTimeBeijing(v),
    },
    {
      title: '操作', width: 140,
      render: (_: unknown, record: EarlyWarningExportTemplate) => (
        <span>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => { setEditingSchedTemplate(record); setSchedModalOpen(true); }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除？"
            onConfirm={async () => {
              await deleteSchedulingExportTemplate(record.id);
              message.success('已删除');
              load();
            }}
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </span>
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
        <Divider />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-medium mb-1 m-0">关账计入加工</p>
            <p className="text-gray-500 text-sm mb-0">
              开启后，订单类型为「加工」的款式按 数量 × 加工单价(USD) × 汇率 计入关账销售产值（万元）；关闭则不计入。
            </p>
          </div>
          <Switch
            checked={closingIncludeProcessing}
            checkedChildren="计入"
            unCheckedChildren="不计入"
            onChange={(checked) => void saveClosingIncludeProcessing(checked)}
          />
        </div>
      </Card>

      <Card title="预警导出模板（JSON 配置）" className="card-panel mb-6">
        <p className="text-gray-500 text-sm mb-4">
          配置预警 Excel 导出的列顺序、标题与列宽。导出时仅输出用户勾选的字段；未勾选的列不会保留。
        </p>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          className="mb-4"
          onClick={() => { setEditingEwTemplate(null); setEwModalOpen(true); }}
        >
          新建模板
        </Button>
        <Table rowKey="id" columns={ewTemplateColumns} dataSource={ewTemplates} pagination={false} size="small" />
      </Card>

      <Card title="排单导出模板（JSON 配置）" className="card-panel mb-6">
        <p className="text-gray-500 text-sm mb-4">
          配置排单 Excel 导出列，含「区位」虚拟列。导出时仅输出用户勾选字段；沙箱模式下不可导出。
        </p>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          className="mb-4"
          onClick={() => { setEditingSchedTemplate(null); setSchedModalOpen(true); }}
        >
          新建模板
        </Button>
        <Table rowKey="id" columns={schedTemplateColumns} dataSource={schedTemplates} pagination={false} size="small" />
      </Card>

      <Card title="Excel 导出模板（报价单）" className="card-panel">
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

      <EarlyWarningExportTemplateModal
        open={ewModalOpen}
        template={editingEwTemplate}
        view="early_warning"
        onClose={() => setEwModalOpen(false)}
        onSaved={load}
      />

      <EarlyWarningExportTemplateModal
        open={schedModalOpen}
        template={editingSchedTemplate}
        view="scheduling"
        onClose={() => setSchedModalOpen(false)}
        onSaved={load}
      />

    </div>
  );
}
