import { useEffect, useMemo, useState } from 'react';

import { Modal, Radio, Checkbox, Button, Space, message, Select } from 'antd';

import type { StyleRecord } from '@/types/style';

import type { EarlyWarningExportTemplate } from '@/types/earlyWarningExportTemplate';

import type { ColumnPreferences } from '@/utils/quotationListColumnPrefs';

import type { EarlyWarningExportMetaInput } from '@/utils/earlyWarningExport';

import {

  EXPORT_COLUMN_OPTIONS,

  getDefaultExportColumnKeys,

  buildEarlyWarningExportMeta,

  downloadBlob,

  filterExportColumnKeys,

  resolveExportColumns,

  getExportFieldLabel,

} from '@/utils/earlyWarningExport';

import { exportEarlyWarningExcel, getEarlyWarningExportTemplates } from '@/api/styles';

import { todayYmd, formatDateTimeBeijing } from '@/utils/beijingTime';



export type EarlyWarningExportScope = 'selected' | 'filtered';



interface EarlyWarningExportModalProps {

  open: boolean;

  onClose: () => void;

  columnPrefs: ColumnPreferences;

  selectedRows: StyleRecord[];

  filteredRows: StyleRecord[];

  metaInput: Omit<EarlyWarningExportMetaInput, 'exportMode' | 'rowCount'>;

}



export default function EarlyWarningExportModal({

  open,

  onClose,

  columnPrefs,

  selectedRows,

  filteredRows,

  metaInput,

}: EarlyWarningExportModalProps) {

  const [scope, setScope] = useState<EarlyWarningExportScope>('filtered');

  const [selectedKeys, setSelectedKeys] = useState<string[]>(() => getDefaultExportColumnKeys(columnPrefs));

  const [exporting, setExporting] = useState(false);

  const [templates, setTemplates] = useState<EarlyWarningExportTemplate[]>([]);

  const [templateId, setTemplateId] = useState<number | null>(null);



  const activeTemplate = useMemo(

    () => templates.find((t) => t.id === templateId) ?? templates.find((t) => t.is_default) ?? templates[0] ?? null,

    [templates, templateId],

  );



  useEffect(() => {

    if (!open) return;

    void getEarlyWarningExportTemplates()

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

    setScope(selectedRows.length > 0 ? 'selected' : 'filtered');

    const fromTemplate = activeTemplate?.config.defaultSelected?.filter(

      (k) => EXPORT_COLUMN_OPTIONS.some((o) => o.key === k),

    );

    if (fromTemplate?.length) {

      setSelectedKeys(fromTemplate);

    } else {

      setSelectedKeys(getDefaultExportColumnKeys(columnPrefs));

    }

  }, [open, columnPrefs, selectedRows.length, activeTemplate?.id]);



  const exportRows = scope === 'selected' ? selectedRows : filteredRows;



  const templateKeySet = useMemo(

    () => new Set(activeTemplate?.config.columns.map((c) => c.key) ?? []),

    [activeTemplate],

  );



  const orderedOptions = useMemo(() => {

    const map = new Map(EXPORT_COLUMN_OPTIONS.map((o) => [o.key, o]));

    const templateOrder = activeTemplate?.config.columns.map((c) => c.key) ?? [];

    const ordered = templateOrder

      .map((key) => map.get(key))

      .filter(Boolean) as typeof EXPORT_COLUMN_OPTIONS;

    for (const opt of EXPORT_COLUMN_OPTIONS) {

      if (!ordered.some((o) => o.key === opt.key)) ordered.push(opt);

    }

    const extraFromPrefs = columnPrefs.order

      .map((key) => map.get(key))

      .filter((o): o is typeof EXPORT_COLUMN_OPTIONS[number] => !!o && !ordered.some((x) => x.key === o.key));

    return [...ordered, ...extraFromPrefs];

  }, [activeTemplate, columnPrefs.order]);



  const allKeys = orderedOptions.map((o) => o.key);

  const allChecked = allKeys.length > 0 && allKeys.every((k) => selectedKeys.includes(k));

  const indeterminate = selectedKeys.length > 0 && !allChecked;



  const toggleAll = (checked: boolean) => {

    setSelectedKeys(checked ? [...allKeys] : []);

  };



  const toggleKey = (key: string, checked: boolean) => {

    setSelectedKeys((prev) => (checked ? [...prev, key] : prev.filter((k) => k !== key)));

  };



  const resetToColumnPrefs = () => {

    const fromTemplate = activeTemplate?.config.defaultSelected;

    if (fromTemplate?.length) {

      setSelectedKeys(fromTemplate.filter((k) => EXPORT_COLUMN_OPTIONS.some((o) => o.key === k)));

    } else {

      setSelectedKeys(getDefaultExportColumnKeys(columnPrefs));

    }

  };



  const handleExport = async () => {

    const keys = columnPrefs.order.filter((k) => selectedKeys.includes(k));

    const extra = selectedKeys.filter((k) => !keys.includes(k));

    const userColumnKeys = filterExportColumnKeys([...keys, ...extra]);

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

      const labels = unconfigured.map(getExportFieldLabel).join('、');

      message.warning(`以下字段未在模板中配置，已追加到末尾：${labels}。请修改导出设置或在系统设置中更新模板。`, 6);

    }



    const styleIds = exportRows

      .map((r) => Number(r.id))

      .filter((id) => Number.isFinite(id) && id > 0);

    if (!styleIds.length) {

      message.warning(scope === 'selected' ? '请先勾选要导出的款式' : '当前筛选结果为空');

      return;

    }



    setExporting(true);

    try {

      const meta = buildEarlyWarningExportMeta({

        ...metaInput,

        exportTime: formatDateTimeBeijing(new Date()),

        exportMode: scope,

        rowCount: styleIds.length,

      });

      const res = await exportEarlyWarningExcel({

        style_ids: styleIds,

        column_keys: userColumnKeys,

        template_id: activeTemplate?.id ?? null,

        meta: {

          ...meta,

          template_name: activeTemplate?.name,

        },

      });

      downloadBlob(new Blob([res.data]), `预警导出_${todayYmd()}.xlsx`);

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

      title="导出预警 Excel"

      open={open}

      onCancel={onClose}

      width={560}

      footer={[

        <Button key="cancel" onClick={onClose}>取消</Button>,

        <Button

          key="export"

          type="primary"

          loading={exporting}

          disabled={!selectedKeys.length || !exportRows.length}

          onClick={() => void handleExport()}

        >

          导出

        </Button>,

      ]}

    >

      <div className="early-warning-export-modal">

        <div className="early-warning-export-section">

          <div className="early-warning-export-label">导出模板</div>

          <Select

            className="w-full"

            placeholder="选择导出模板"

            value={activeTemplate?.id}

            onChange={(id) => {
              setTemplateId(id);
              const tpl = templates.find((t) => t.id === id);
              const defaults = tpl?.config.defaultSelected?.filter(
                (k) => EXPORT_COLUMN_OPTIONS.some((o) => o.key === k),
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

              <Radio value="filtered" disabled={filteredRows.length === 0}>

                当前筛选全部（{filteredRows.length} 条）

              </Radio>

              <Radio value="selected" disabled={selectedRows.length === 0}>

                仅选中行（{selectedRows.length} 条）

              </Radio>

            </Space>

          </Radio.Group>

        </div>



        <div className="early-warning-export-section">

          <div className="early-warning-export-toolbar">

            <span className="early-warning-export-label">导出字段</span>

            <Space size={8}>

              <Button type="link" size="small" className="!px-0 !h-auto" onClick={() => toggleAll(true)}>

                全选

              </Button>

              <Button type="link" size="small" className="!px-0 !h-auto" onClick={() => toggleAll(false)}>

                清空

              </Button>

              <Button type="link" size="small" className="!px-0 !h-auto" onClick={resetToColumnPrefs}>

                恢复默认勾选

              </Button>

            </Space>

          </div>

          <div className="early-warning-export-fields">

            <Checkbox

              indeterminate={indeterminate}

              checked={allChecked}

              onChange={(e) => toggleAll(e.target.checked)}

              className="early-warning-export-check-all"

            >

              全部字段

            </Checkbox>

            <div className="early-warning-export-field-grid">

              {orderedOptions.map((opt) => (

                <Checkbox

                  key={opt.key}

                  checked={selectedKeys.includes(opt.key)}

                  onChange={(e) => toggleKey(opt.key, e.target.checked)}

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

          仅导出勾选的字段；模板未包含的勾选字段会提示并追加到末尾。款式图将嵌入 Excel，数据行高由模板控制。

        </p>

      </div>

    </Modal>

  );

}

