import { useEffect, useMemo, useState } from 'react';
import {
  Modal, Input, Switch, Button, Table, Select, InputNumber, Checkbox, Space, message,
} from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type {
  EarlyWarningExportTemplate,
  EarlyWarningTemplateColumn,
  EarlyWarningTemplateConfig,
  ExportTemplateView,
} from '@/types/earlyWarningExportTemplate';
import { EXPORT_COLUMN_OPTIONS } from '@/utils/earlyWarningExport';
import { SCHEDULING_EXPORT_COLUMN_OPTIONS } from '@/utils/schedulingExport';
import {
  createEarlyWarningExportTemplate,
  updateEarlyWarningExportTemplate,
  createSchedulingExportTemplate,
  updateSchedulingExportTemplate,
} from '@/api';

export function buildDefaultTemplateConfig(view: ExportTemplateView = 'early_warning'): EarlyWarningTemplateConfig {
  const options = view === 'scheduling' ? SCHEDULING_EXPORT_COLUMN_OPTIONS : EXPORT_COLUMN_OPTIONS;
  return {
    columns: options.map((o) => ({
      key: o.key,
      title: o.label,
      width: o.key === 'style_image' ? 5 : o.key === 'scheduling_zone_label' ? 12 : undefined,
    })),
    defaultSelected: view === 'scheduling'
      ? ['scheduling_zone_label', 'style_number', 'brand', 'group_name', 'quantity', 'online_time', 'offline_time', 'scheduled_output']
      : ['style_number', 'brand', 'quantity', 'style_name', 'salesperson', 'required_shipping_date', 'closing_month', 'fabric_readiness'],
    headerStyle: { fillArgb: 'FF2563EB', fontColorArgb: 'FFFFFFFF' },
    rowHeight: 20,
  };
}

interface EarlyWarningExportTemplateModalProps {
  open: boolean;
  template: EarlyWarningExportTemplate | null;
  view?: ExportTemplateView;
  onClose: () => void;
  onSaved: () => void;
}

export default function EarlyWarningExportTemplateModal({
  open,
  template,
  view = 'early_warning',
  onClose,
  onSaved,
}: EarlyWarningExportTemplateModalProps) {
  const fieldOptions = view === 'scheduling' ? SCHEDULING_EXPORT_COLUMN_OPTIONS : EXPORT_COLUMN_OPTIONS;
  const FIELD_OPTIONS = fieldOptions.map((o) => ({ value: o.key, label: o.label }));
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [columns, setColumns] = useState<EarlyWarningTemplateColumn[]>([]);
  const [defaultSelected, setDefaultSelected] = useState<string[]>([]);
  const [rowHeight, setRowHeight] = useState(20);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (template) {
      setName(template.name);
      setIsDefault(template.is_default);
      setColumns(template.config.columns.map((c) => ({ ...c })));
      setDefaultSelected(template.config.defaultSelected ? [...template.config.defaultSelected] : []);
      setRowHeight(template.config.rowHeight ?? 20);
    } else {
      const defaults = buildDefaultTemplateConfig(view);
      setName('');
      setIsDefault(false);
      setColumns(defaults.columns.map((c) => ({ ...c })));
      setDefaultSelected(defaults.defaultSelected ? [...defaults.defaultSelected] : []);
      setRowHeight(defaults.rowHeight ?? 20);
    }
  }, [open, template, view]);

  const usedKeys = useMemo(() => new Set(columns.map((c) => c.key)), [columns]);

  const moveColumn = (index: number, direction: -1 | 1) => {
    const next = [...columns];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setColumns(next);
  };

  const updateColumn = (index: number, patch: Partial<EarlyWarningTemplateColumn>) => {
    setColumns((prev) => prev.map((col, i) => (i === index ? { ...col, ...patch } : col)));
  };

  const removeColumn = (index: number) => {
    const key = columns[index]?.key;
    setColumns((prev) => prev.filter((_, i) => i !== index));
    if (key) setDefaultSelected((prev) => prev.filter((k) => k !== key));
  };

  const addColumn = () => {
    const available = FIELD_OPTIONS.find((o) => !usedKeys.has(o.value));
    if (!available) {
      message.warning('所有字段已添加');
      return;
    }
    setColumns((prev) => [...prev, { key: available.value, title: available.label }]);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      message.warning('请输入模板名称');
      return;
    }
    if (!columns.length) {
      message.warning('请至少添加一列');
      return;
    }
    const config: EarlyWarningTemplateConfig = {
      columns,
      defaultSelected: defaultSelected.filter((k) => usedKeys.has(k)),
      headerStyle: { fillArgb: 'FF2563EB', fontColorArgb: 'FFFFFFFF' },
      rowHeight,
    };
    setSaving(true);
    try {
      if (template) {
        if (view === 'scheduling') {
          await updateSchedulingExportTemplate(template.id, {
            name: name.trim(),
            config,
            is_default: isDefault,
          });
        } else {
          await updateEarlyWarningExportTemplate(template.id, {
            name: name.trim(),
            config,
            is_default: isDefault,
          });
        }
        message.success('模板已更新');
      } else if (view === 'scheduling') {
        await createSchedulingExportTemplate({
          name: name.trim(),
          config,
          is_default: isDefault,
        });
        message.success('模板已创建');
      } else {
        await createEarlyWarningExportTemplate({
          name: name.trim(),
          config,
          is_default: isDefault,
        });
        message.success('模板已创建');
      }
      onSaved();
      onClose();
    } catch (err) {
      message.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={template
        ? (view === 'scheduling' ? '编辑排单导出模板' : '编辑预警导出模板')
        : (view === 'scheduling' ? '新建排单导出模板' : '新建预警导出模板')}
      open={open}
      onCancel={onClose}
      width={720}
      footer={[
        <Button key="cancel" onClick={onClose}>取消</Button>,
        <Button key="save" type="primary" loading={saving} onClick={() => void handleSave()}>
          保存
        </Button>,
      ]}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="text-sm text-gray-500 mb-1">模板名称</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：业务部标准导出" />
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">设为默认</div>
            <Switch checked={isDefault} onChange={setIsDefault} />
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">数据行高（磅）</div>
            <InputNumber min={12} max={40} value={rowHeight} onChange={(v) => setRowHeight(v ?? 20)} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">模板列（顺序即导出列顺序）</span>
            <Button size="small" icon={<PlusOutlined />} onClick={addColumn}>添加列</Button>
          </div>
          <Table
            size="small"
            pagination={false}
            rowKey={(_, index) => String(index)}
            dataSource={columns.map((col, index) => ({ ...col, index }))}
            columns={[
              {
                title: '顺序',
                width: 88,
                render: (_: unknown, record: EarlyWarningTemplateColumn & { index: number }) => (
                  <Space size={4}>
                    <Button
                      type="text"
                      size="small"
                      icon={<ArrowUpOutlined />}
                      disabled={record.index === 0}
                      onClick={() => moveColumn(record.index, -1)}
                    />
                    <Button
                      type="text"
                      size="small"
                      icon={<ArrowDownOutlined />}
                      disabled={record.index === columns.length - 1}
                      onClick={() => moveColumn(record.index, 1)}
                    />
                  </Space>
                ),
              },
              {
                title: '字段',
                width: 160,
                render: (_: unknown, record: EarlyWarningTemplateColumn & { index: number }) => (
                  <Select
                    className="w-full"
                    value={record.key}
                    options={FIELD_OPTIONS.map((o) => ({
                      ...o,
                      disabled: o.value !== record.key && usedKeys.has(o.value),
                    }))}
                    onChange={(key) => {
                      const label = FIELD_OPTIONS.find((o) => o.value === key)?.label;
                      updateColumn(record.index, {
                        key,
                        title: label,
                        width: key === 'style_image' ? 5 : undefined,
                      });
                      setDefaultSelected((prev) => prev.map((k) => (k === record.key ? key : k)));
                    }}
                  />
                ),
              },
              {
                title: '列标题',
                render: (_: unknown, record: EarlyWarningTemplateColumn & { index: number }) => (
                  <Input
                    value={record.title}
                    onChange={(e) => updateColumn(record.index, { title: e.target.value })}
                  />
                ),
              },
              {
                title: '列宽',
                width: 88,
                render: (_: unknown, record: EarlyWarningTemplateColumn & { index: number }) => (
                  <InputNumber
                    min={4}
                    max={60}
                    className="w-full"
                    value={record.width}
                    placeholder="自动"
                    onChange={(v) => updateColumn(record.index, { width: v ?? undefined })}
                  />
                ),
              },
              {
                title: '',
                width: 48,
                render: (_: unknown, record: EarlyWarningTemplateColumn & { index: number }) => (
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => removeColumn(record.index)}
                  />
                ),
              },
            ]}
          />
        </div>

        <div>
          <div className="text-sm font-medium mb-2">打开导出弹窗时默认勾选</div>
          <Checkbox.Group
            value={defaultSelected}
            onChange={(vals) => setDefaultSelected(vals as string[])}
            className="early-warning-export-field-grid"
          >
            {columns.map((col) => {
              const label = col.title || FIELD_OPTIONS.find((o) => o.value === col.key)?.label || col.key;
              return (
                <Checkbox key={col.key} value={col.key}>{label}</Checkbox>
              );
            })}
          </Checkbox.Group>
        </div>

        <p className="text-xs text-gray-500 mb-0">
          导出时仅包含用户勾选的字段；未勾选的不输出。若用户勾选了模板未配置的字段，将提示并追加到末尾。
        </p>
      </div>
    </Modal>
  );
}
