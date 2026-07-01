import { useEffect, useMemo, useState } from 'react';
import { Modal, Radio, Checkbox, Button, Space, message, Select } from 'antd';
import type { StyleRecord } from '@/types/style';
import type { EarlyWarningExportTemplate } from '@/types/earlyWarningExportTemplate';
import type { ColumnPreferences } from '@/utils/quotationListColumnPrefs';
import {
  SCHEDULING_EXPORT_COLUMN_OPTIONS,
  SCHEDULING_ZONE_EXPORT_OPTIONS,
  SCHEDULING_ZONE_VIRTUAL_KEY,
  getDefaultSchedulingExportColumnKeys,
  getSchedulingExportFieldLabel,
  buildSchedulingExportMeta,
  filterExportColumnKeys,
  resolveExportColumns,
  filterRowsByZoneKeys,
  filterRowsForSchedulingExport,
  downloadBlob,
} from '@/utils/schedulingExport';
import { exportSchedulingExcel, getSchedulingExportTemplates } from '@/api/styles';
import { todayYmd, formatDateTimeBeijing } from '@/utils/beijingTime';

export type SchedulingExportScope = 'filtered' | 'zones';

interface SchedulingExportModalProps {
  open: boolean;
  onClose: () => void;
  columnPrefs: ColumnPreferences;
  filteredRows: StyleRecord[];
  searchKeyword: string;
  exportUser: string;
  sandboxMode: boolean;
}

export default function SchedulingExportModal({
  open,
  onClose,
  columnPrefs,
  filteredRows,
  searchKeyword,
  exportUser,
  sandboxMode,
}: SchedulingExportModalProps) {
  const [scope, setScope] = useState<SchedulingExportScope>('filtered');
  const [zoneKeys, setZoneKeys] = useState<string[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(() => getDefaultSchedulingExportColumnKeys(columnPrefs));
  const [exporting, setExporting] = useState(false);
  const [templates, setTemplates] = useState<EarlyWarningExportTemplate[]>([]);
  const [templateId, setTemplateId] = useState<number | null>(null);

  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) ?? templates.find((t) => t.is_default) ?? templates[0] ?? null,
    [templates, templateId],
  );

  useEffect(() => {
    if (!open) return;
    void getSchedulingExportTemplates()
      .then((res) => {
        const list = res.data || [];
        setTemplates(list);
        const def = list.find((t) => t.is_default) ?? list[0];
        setTemplateId(def?.id ?? null);
      })
      .catch(() => setTemplates([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setScope('filtered');
    setZoneKeys([]);
    const fromTemplate = activeTemplate?.config.defaultSelected?.filter(
      (k) => SCHEDULING_EXPORT_COLUMN_OPTIONS.some((o) => o.key === k),
    );
    if (fromTemplate?.length) {
      setSelectedKeys(fromTemplate);
    } else {
      setSelectedKeys(getDefaultSchedulingExportColumnKeys(columnPrefs));
    }
  }, [open, columnPrefs, activeTemplate?.id]);

  const exportableRows = useMemo(() => filterRowsForSchedulingExport(filteredRows), [filteredRows]);

  const exportRows = useMemo(() => {
    if (scope === 'zones' && zoneKeys.length > 0) {
      return filterRowsByZoneKeys(filteredRows, zoneKeys);
    }
    return exportableRows;
  }, [scope, zoneKeys, filteredRows, exportableRows]);

  const templateKeySet = useMemo(
    () => new Set(activeTemplate?.config.columns.map((c) => c.key) ?? []),
    [activeTemplate],
  );

  const orderedOptions = useMemo(() => {
    const map = new Map(SCHEDULING_EXPORT_COLUMN_OPTIONS.map((o) => [o.key, o]));
    const templateOrder = activeTemplate?.config.columns.map((c) => c.key) ?? [];
    const ordered = templateOrder
      .map((key) => map.get(key))
      .filter(Boolean) as typeof SCHEDULING_EXPORT_COLUMN_OPTIONS;
    for (const opt of SCHEDULING_EXPORT_COLUMN_OPTIONS) {
      if (!ordered.some((o) => o.key === opt.key)) ordered.push(opt);
    }
    return ordered;
  }, [activeTemplate]);

  const allKeys = orderedOptions.map((o) => o.key);
  const allChecked = allKeys.length > 0 && allKeys.every((k) => selectedKeys.includes(k));
  const indeterminate = selectedKeys.length > 0 && !allChecked;

  const handleExport = async () => {
    if (sandboxMode) {
      message.warning('排单沙箱模式下不可导出，请先退出沙箱');
      return;
    }

    const keys = columnPrefs.order.filter((k) => selectedKeys.includes(k));
    const extra = selectedKeys.filter((k) => !keys.includes(k));
    const userColumnKeys = filterExportColumnKeys([...keys, ...extra]);
    if (!userColumnKeys.includes(SCHEDULING_ZONE_VIRTUAL_KEY) && selectedKeys.includes(SCHEDULING_ZONE_VIRTUAL_KEY)) {
      userColumnKeys.unshift(SCHEDULING_ZONE_VIRTUAL_KEY);
    }
    if (!userColumnKeys.length) {
      message.warning('请至少选择一个可导出字段');
      return;
    }

    const { keys: exportColumnKeys, unconfigured } = resolveExportColumns(
      activeTemplate?.config,
      userColumnKeys,
    );
    if (!exportColumnKeys.length) {
      message.warning('请至少选择一个可导出字段');
      return;
    }

    if (unconfigured.length > 0) {
      const labels = unconfigured.map(getSchedulingExportFieldLabel).join('、');
      message.warning(`以下字段未在模板中配置，已追加到末尾：${labels}。请修改导出设置或在系统设置中更新模板。`, 6);
    }

    const styleIds = exportRows
      .map((r) => Number(r.id))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (!styleIds.length) {
      message.warning(scope === 'zones' ? '所选区位暂无款式' : '当前筛选结果为空');
      return;
    }

    setExporting(true);
    try {
      const meta = buildSchedulingExportMeta({
        exportUser,
        exportTime: formatDateTimeBeijing(new Date()),
        searchKeyword,
        exportMode: scope,
        zoneKeys: scope === 'zones' ? zoneKeys : undefined,
        rowCount: styleIds.length,
      });
      const res = await exportSchedulingExcel({
        style_ids: styleIds,
        column_keys: userColumnKeys,
        template_id: activeTemplate?.id ?? null,
        meta: {
          ...meta,
          template_name: activeTemplate?.name,
        },
      });
      downloadBlob(new Blob([res.data]), `排单导出_${todayYmd()}.xlsx`);
      message.success(`已导出 ${styleIds.length} 条`);
      onClose();
    } catch (err) {
      message.error(String(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      title="导出排单 Excel"
      open={open}
      onCancel={onClose}
      width={580}
      footer={[
        <Button key="cancel" onClick={onClose}>取消</Button>,
        <Button
          key="export"
          type="primary"
          loading={exporting}
          disabled={sandboxMode || !selectedKeys.length || !exportRows.length}
          onClick={() => void handleExport()}
        >
          导出
        </Button>,
      ]}
    >
      {sandboxMode && (
        <p className="text-amber-600 text-sm mb-3">排单沙箱为预览数据，不可导出。请先退出沙箱后再导出。</p>
      )}
      <div className="early-warning-export-modal">
        <div className="early-warning-export-section">
          <div className="early-warning-export-label">导出模板</div>
          <Select
            className="w-full"
            value={activeTemplate?.id}
            onChange={(id) => {
              setTemplateId(id);
              const tpl = templates.find((t) => t.id === id);
              const defaults = tpl?.config.defaultSelected?.filter(
                (k) => SCHEDULING_EXPORT_COLUMN_OPTIONS.some((o) => o.key === k),
              );
              if (defaults?.length) setSelectedKeys(defaults);
            }}
            options={templates.map((t) => ({
              value: t.id,
              label: t.is_default ? `${t.name}（默认）` : t.name,
            }))}
          />
        </div>

        <div className="early-warning-export-section">
          <div className="early-warning-export-label">导出范围</div>
          <Radio.Group value={scope} onChange={(e) => setScope(e.target.value)}>
            <Space direction="vertical">
              <Radio value="filtered" disabled={exportableRows.length === 0}>
                当前筛选全部（{exportableRows.length} 条，不含下线区）
              </Radio>
              <Radio value="zones" disabled={exportableRows.length === 0}>
                指定区位
              </Radio>
            </Space>
          </Radio.Group>
          {scope === 'zones' && (
            <Select
              mode="multiple"
              className="w-full mt-2"
              placeholder="选择区位"
              value={zoneKeys}
              onChange={setZoneKeys}
              options={SCHEDULING_ZONE_EXPORT_OPTIONS}
            />
          )}
          {scope === 'zones' && zoneKeys.length > 0 && (
            <p className="text-xs text-gray-500 mt-1 mb-0">已选区位共 {exportRows.length} 条</p>
          )}
        </div>

        <div className="early-warning-export-section">
          <div className="early-warning-export-toolbar">
            <span className="early-warning-export-label">导出字段</span>
            <Space size={8}>
              <Button type="link" size="small" className="!px-0 !h-auto" onClick={() => setSelectedKeys([...allKeys])}>全选</Button>
              <Button type="link" size="small" className="!px-0 !h-auto" onClick={() => setSelectedKeys([])}>清空</Button>
              <Button type="link" size="small" className="!px-0 !h-auto" onClick={() => setSelectedKeys(getDefaultSchedulingExportColumnKeys(columnPrefs))}>恢复默认勾选</Button>
            </Space>
          </div>
          <div className="early-warning-export-fields">
            <Checkbox
              indeterminate={indeterminate}
              checked={allChecked}
              onChange={(e) => setSelectedKeys(e.target.checked ? [...allKeys] : [])}
              className="early-warning-export-check-all"
            >
              全部字段
            </Checkbox>
            <div className="early-warning-export-field-grid">
              {orderedOptions.map((opt) => (
                <Checkbox
                  key={opt.key}
                  checked={selectedKeys.includes(opt.key)}
                  onChange={(e) => setSelectedKeys((prev) => (
                    e.target.checked ? [...prev, opt.key] : prev.filter((k) => k !== opt.key)
                  ))}
                >
                  {opt.label}
                  {!templateKeySet.has(opt.key) && (
                    <span className="text-amber-600 text-xs ml-1">（未配置）</span>
                  )}
                </Checkbox>
              ))}
            </div>
          </div>
        </div>

        <p className="early-warning-export-hint">
          按区位分组导出：待排单 → 1–13、15、16 生产组 → 外发订单；每组前重复表头。下线区不输出。沙箱模式下不可导出。
        </p>
      </div>
    </Modal>
  );
}
