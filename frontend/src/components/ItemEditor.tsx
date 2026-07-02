import { useState, useMemo, useCallback, useEffect, type MouseEvent } from 'react';
import {
  Input, InputNumber, Select, Button, Table, Collapse, Space, Modal, Tag, Spin, AutoComplete, message,
} from 'antd';
import { PlusOutlined, DeleteOutlined, BranchesOutlined } from '@ant-design/icons';
import type { QuotationItem, Fabric, Accessory } from '@/types';
import { createEmptyFabric, createEmptyAccessory, UNIT_LABELS } from '@/types';
import { calcItemCost, calcGrossWidth, calcNetWidth, calcFabricConsumption, calcAccessoryAmount } from '@/utils/calculation';
import { getVersionButtonStyle, type VersionRowDraft } from '@/utils/quotationVersionGroups';
import { toNum } from '@/utils/normalize';
import CostSummary from '@/components/CostSummary';
import FileUpload from '@/components/FileUpload';
import AttachmentPreviewList from '@/components/AttachmentPreviewList';
import { FieldPermission } from '@/components/FieldPermission';
import ResizableTableHeader from '@/components/ResizableTableHeader';
import {
  FABRIC_COLUMN_DEFS,
  ACCESSORY_COLUMN_DEFS,
  loadFabricColumnWidths,
  loadAccessoryColumnWidths,
  saveFabricColumnWidths,
  saveAccessoryColumnWidths,
  applyItemEditorColumnWidths,
  estimateItemEditorScrollX,
} from '@/utils/itemEditorColumnPrefs';

const TABLE_HEADER_COMPONENTS = { header: { cell: ResizableTableHeader } };

interface ItemEditorProps {
  groupKey: string;
  itemIndices: number[];
  items: QuotationItem[];
  productCode?: string;
  exchangeRate: number;
  currency: 'RMB' | 'USD';
  profitMargin: number;
  fabricOptions: Array<{ value: number; label: string; data: Fabric; use_count?: number }>;
  accessoryOptions: Array<{ value: number; label: string; data: Accessory; use_count?: number }>;
  defaultWastage?: number;
  optionsReady?: boolean;
  onUpdateItem: (index: number, item: QuotationItem) => void;
  onRemoveVersion: (index: number) => void;
  onAddVersions: (sourceIndex: number, rows: VersionRowDraft[]) => void;
  readOnly?: boolean;
}

export default function ItemEditor({
  groupKey,
  itemIndices,
  items,
  productCode = '',
  exchangeRate,
  currency,
  profitMargin,
  fabricOptions,
  accessoryOptions,
  defaultWastage = 5,
  optionsReady = true,
  onUpdateItem,
  onRemoveVersion,
  onAddVersions,
  readOnly,
}: ItemEditorProps) {
  const [activeItemIndex, setActiveItemIndex] = useState(() => itemIndices[0] ?? 0);
  const [versionModal, setVersionModal] = useState(false);
  const [versionRows, setVersionRows] = useState<VersionRowDraft[]>([{ version_label: '' }]);
  const [fabricColWidths, setFabricColWidths] = useState(loadFabricColumnWidths);
  const [accessoryColWidths, setAccessoryColWidths] = useState(loadAccessoryColumnWidths);

  useEffect(() => {
    if (!itemIndices.includes(activeItemIndex)) {
      setActiveItemIndex(itemIndices[0] ?? 0);
    }
  }, [itemIndices, activeItemIndex]);

  const item = items[activeItemIndex] ?? items[itemIndices[0]];

  const handleFabricColResize = useCallback((key: string, width: number) => {
    setFabricColWidths((prev) => ({ ...prev, [key]: width }));
  }, []);

  const handleFabricColResizeStop = useCallback((key: string, width: number) => {
    setFabricColWidths((prev) => {
      const next = { ...prev, [key]: width };
      saveFabricColumnWidths(next);
      return next;
    });
  }, []);

  const handleAccessoryColResize = useCallback((key: string, width: number) => {
    setAccessoryColWidths((prev) => ({ ...prev, [key]: width }));
  }, []);

  const handleAccessoryColResizeStop = useCallback((key: string, width: number) => {
    setAccessoryColWidths((prev) => {
      const next = { ...prev, [key]: width };
      saveAccessoryColumnWidths(next);
      return next;
    });
  }, []);

  const toFabricCalcInput = (r: Fabric) => ({
    pieceLength: r.piece_length || 0,
    wastage: r.wastage ?? 5,
    unit: (r.unit || 'meter') as 'meter' | 'kg',
    netWidth: r.net_width || 0,
    grossWidth: r.gross_width ?? calcGrossWidth(r.net_width || 0),
    weight: r.weight || 0,
    unitPrice: r.unit_price || 0,
  });

  const cost = useMemo(() => {
    if (!item) {
      return { fabricTotal: 0, accessoryTotal: 0, laborRmb: 0, subtotalRmb: 0, finalPrice: 0, fabrics: [], accessories: [] };
    }
    return calcItemCost(
      {
        laborCostUsd: item.labor_cost_usd || 0,
        otherCostRmb: item.other_cost_rmb || 0,
        shippingRmb: item.shipping_rmb ?? 1,
        fabrics: (item.fabrics || []).map((f) => toFabricCalcInput(f)),
        accessories: (item.accessories || []).map((a) => ({
          consumption: a.consumption ?? 1,
          wastage: a.wastage ?? 5,
          unitPrice: a.unit_price || 0,
        })),
      },
      exchangeRate,
      currency,
      profitMargin
    );
  }, [item, exchangeRate, currency, profitMargin]);

  const update = (patch: Partial<QuotationItem>) => {
    if (!item) return;
    onUpdateItem(activeItemIndex, { ...item, ...patch });
  };

  const itemAttachments = useMemo(
    () => [
      ...(item.pattern_files || []),
      ...(item.layout_files || []),
      ...(item.sample_images || []),
    ],
    [item.pattern_files, item.layout_files, item.sample_images]
  );

  const setItemAttachments = (paths: string[]) => {
    update({ pattern_files: paths, layout_files: [], sample_images: [] });
  };

  const addFabric = () => update({ fabrics: [...(item.fabrics || []), createEmptyFabric(defaultWastage)] });
  const updateFabric = (idx: number, patch: Partial<Fabric>) => {
    const fabrics = [...(item.fabrics || [])];
    fabrics[idx] = { ...fabrics[idx], ...patch };
    if (patch.gross_width !== undefined && patch.net_width === undefined) {
      fabrics[idx].net_width = calcNetWidth(Number(patch.gross_width));
    } else if (patch.net_width !== undefined && patch.gross_width === undefined) {
      fabrics[idx].gross_width = calcGrossWidth(Number(patch.net_width));
    }
    update({ fabrics });
  };
  const removeFabric = (idx: number) => update({ fabrics: (item.fabrics || []).filter((_, i) => i !== idx) });

  const selectFabric = (idx: number, fabricId: number) => {
    const opt = fabricOptions.find((o) => o.value === fabricId);
    if (opt) {
      const fabricWastage = opt.data.default_wastage ?? defaultWastage;
      updateFabric(idx, {
        fabric_id: fabricId,
        name: opt.data.name,
        composition: opt.data.composition,
        weight: opt.data.weight,
        net_width: opt.data.net_width,
        gross_width: calcGrossWidth(opt.data.net_width || 0),
        unit: opt.data.unit,
        unit_price: opt.data.reference_price || opt.data.unit_price,
        wastage: fabricWastage,
      });
    }
  };

  /** 输入面料名称后回车：精确/唯一匹配则选库，否则保存为手动输入 */
  const commitFabricInput = (idx: number, rawName: string) => {
    const trimmed = rawName.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    const exact = fabricOptions.find((o) => o.label.toLowerCase() === lower);
    if (exact) {
      selectFabric(idx, exact.value);
      return;
    }
    const partial = fabricOptions.filter((o) => o.label.toLowerCase().includes(lower));
    if (partial.length === 1) {
      selectFabric(idx, partial[0].value);
      return;
    }
    updateFabric(idx, { name: trimmed, fabric_id: undefined });
  };

  const fabricAutoCompleteOptions = fabricOptions.map((o) => ({
    value: String(o.value),
    label: o.data.weight != null ? `${o.label} (${o.data.weight}g/m²)` : o.label,
  }));

  const addAccessory = () => update({ accessories: [...(item.accessories || []), createEmptyAccessory(defaultWastage)] });
  const updateAccessory = (idx: number, patch: Partial<Accessory>) => {
    const accessories = [...(item.accessories || [])];
    accessories[idx] = { ...accessories[idx], ...patch };
    update({ accessories });
  };
  const removeAccessory = (idx: number) => update({ accessories: (item.accessories || []).filter((_, i) => i !== idx) });

  const selectAccessory = (idx: number, accId: number) => {
    const opt = accessoryOptions.find((o) => o.value === accId);
    if (opt) {
      updateAccessory(idx, {
        accessory_id: accId,
        name: opt.data.name,
        specification: opt.data.specification,
        unit_price: opt.data.reference_price || opt.data.unit_price,
      });
    }
  };

  const commitAccessoryInput = (idx: number, rawName: string) => {
    const trimmed = rawName.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    const exact = accessoryOptions.find((o) => o.label.toLowerCase() === lower);
    if (exact) {
      selectAccessory(idx, exact.value);
      return;
    }
    const partial = accessoryOptions.filter((o) => o.label.toLowerCase().includes(lower));
    if (partial.length === 1) {
      selectAccessory(idx, partial[0].value);
      return;
    }
    updateAccessory(idx, { name: trimmed, accessory_id: undefined });
  };

  const accessoryAutoCompleteOptions = accessoryOptions.map((o) => ({
    value: String(o.value),
    label: o.label,
  }));

  const fabricSelectNotFound = optionsReady ? '暂无数据' : <Spin size="small" />;

  const fabricColumns = [
    {
      key: 'name', title: '面料', dataIndex: 'name', width: 180,
      render: (_: unknown, r: Fabric, idx: number) => readOnly ? item.fabrics?.[idx]?.name : (
        <AutoComplete
          className="w-full"
          value={r.name || ''}
          placeholder="输入搜索，回车确认"
          options={optionsReady ? fabricAutoCompleteOptions : []}
          defaultActiveFirstOption
          onSelect={(value) => selectFabric(idx, Number(value))}
          onChange={(text) => {
            const linked = fabricOptions.find((o) => o.value === r.fabric_id);
            if (linked && linked.label !== text) {
              updateFabric(idx, { name: text, fabric_id: undefined });
            } else {
              updateFabric(idx, { name: text });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              commitFabricInput(idx, r.name || '');
            }
          }}
          filterOption={(input, option) => {
            const opt = fabricOptions.find((o) => String(o.value) === option?.value);
            return opt?.label.toLowerCase().includes(input.toLowerCase()) ?? false;
          }}
          notFoundContent={fabricSelectNotFound}
        />
      ),
    },
    {
      key: 'composition', title: '成分', dataIndex: 'composition', width: 120,
      render: (_: unknown, r: Fabric, idx: number) => readOnly ? r.composition : (
        <Input size="small" value={r.composition} onChange={(e) => updateFabric(idx, { composition: e.target.value })} />
      ),
    },
    {
      key: 'weight', title: '克重(g/m²)', dataIndex: 'weight', width: 100,
      render: (_: unknown, r: Fabric, idx: number) => readOnly ? (r.weight != null ? r.weight : '-') : (
        <InputNumber
          size="small"
          className="w-full"
          value={r.weight}
          min={0}
          step={1}
          placeholder="克重"
          onChange={(v) => updateFabric(idx, { weight: v ?? 0 })}
        />
      ),
    },
    {
      key: 'net_width', title: '净门幅(厘米)', dataIndex: 'net_width', width: 110,
      render: (_: unknown, r: Fabric, idx: number) => readOnly ? (r.net_width ?? '-') : (
        <InputNumber
          size="small"
          className="w-full"
          value={r.net_width}
          min={0}
          step={0.1}
          onChange={(v) => updateFabric(idx, { net_width: v ?? 0 })}
        />
      ),
    },
    {
      key: 'gross_width', title: '毛门幅(厘米)', dataIndex: 'gross_width', width: 110,
      render: (_: unknown, r: Fabric, idx: number) => readOnly ? (r.gross_width ?? '-') : (
        <InputNumber
          size="small"
          className="w-full"
          value={r.gross_width}
          min={0}
          step={0.1}
          onChange={(v) => updateFabric(idx, { gross_width: v ?? 0 })}
        />
      ),
    },
    {
      key: 'unit', title: '单位', dataIndex: 'unit', width: 90,
      render: (_: unknown, r: Fabric, idx: number) => readOnly ? (UNIT_LABELS[r.unit] || r.unit) : (
        <Select
          size="small"
          className="w-full"
          value={r.unit || 'meter'}
          onChange={(v) => updateFabric(idx, { unit: v })}
          options={[{ value: 'meter', label: '米' }, { value: 'kg', label: '千克' }]}
        />
      ),
    },
    {
      key: 'piece_length', title: '段长(厘米)', dataIndex: 'piece_length', width: 100,
      render: (_: unknown, r: Fabric, idx: number) => readOnly ? r.piece_length : (
        <InputNumber size="small" value={r.piece_length} onChange={(v) => updateFabric(idx, { piece_length: v || 0 })} min={0} step={0.01} className="w-full" addonAfter="cm" />
      ),
    },
    {
      key: 'wastage', title: '损耗%', dataIndex: 'wastage', width: 80,
      render: (_: unknown, r: Fabric, idx: number) => readOnly ? r.wastage : (
        <InputNumber size="small" value={r.wastage} onChange={(v) => updateFabric(idx, { wastage: v ?? 5 })} min={0} max={100} className="w-full" />
      ),
    },
    {
      key: 'consumption', title: '单耗', width: 80,
      render: (_: unknown, r: Fabric) => calcFabricConsumption(toFabricCalcInput(r)).toFixed(2),
    },
    {
      key: 'unit_price', title: '单价', dataIndex: 'unit_price', width: 90,
      render: (_: unknown, r: Fabric, idx: number) => readOnly ? toNum(r.unit_price).toFixed(2) : (
        <InputNumber size="small" value={r.unit_price} onChange={(v) => updateFabric(idx, { unit_price: v || 0 })} min={0} step={0.01} className="w-full" />
      ),
    },
    {
      key: 'amount', title: '金额', width: 80,
      render: (_: unknown, r: Fabric) => {
        const input = toFabricCalcInput(r);
        const c = calcFabricConsumption(input);
        return (c * (r.unit_price || 0)).toFixed(2);
      },
    },
    ...(!readOnly ? [{ key: 'action', title: '', width: 50, render: (_: unknown, __: Fabric, idx: number) => (
      <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeFabric(idx)} />
    )}] : []),
  ];

  const accessoryColumns = [
    {
      key: 'name', title: '辅料', dataIndex: 'name', width: 160,
      render: (_: unknown, r: Accessory, idx: number) => readOnly ? r.name : (
        <AutoComplete
          className="w-full"
          value={r.name || ''}
          placeholder="输入搜索，回车确认"
          options={optionsReady ? accessoryAutoCompleteOptions : []}
          defaultActiveFirstOption
          onSelect={(value) => selectAccessory(idx, Number(value))}
          onChange={(text) => {
            const linked = accessoryOptions.find((o) => o.value === r.accessory_id);
            if (linked && linked.label !== text) {
              updateAccessory(idx, { name: text, accessory_id: undefined });
            } else {
              updateAccessory(idx, { name: text });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              commitAccessoryInput(idx, r.name || '');
            }
          }}
          filterOption={(input, option) => {
            const opt = accessoryOptions.find((o) => String(o.value) === option?.value);
            return opt?.label.toLowerCase().includes(input.toLowerCase()) ?? false;
          }}
          notFoundContent={fabricSelectNotFound}
        />
      ),
    },
    {
      key: 'specification', title: '规格', dataIndex: 'specification', width: 140,
      render: (_: unknown, r: Accessory, idx: number) => readOnly ? r.specification : (
        <Input size="small" value={r.specification} onChange={(e) => updateAccessory(idx, { specification: e.target.value })} placeholder="如：3#拉链，铜色" />
      ),
    },
    {
      key: 'consumption', title: '单耗', dataIndex: 'consumption', width: 80,
      render: (_: unknown, r: Accessory, idx: number) => readOnly ? r.consumption : (
        <InputNumber size="small" value={r.consumption} onChange={(v) => updateAccessory(idx, { consumption: v ?? 1 })} min={0} step={0.01} className="w-full" />
      ),
    },
    {
      key: 'wastage', title: '损耗%', dataIndex: 'wastage', width: 80,
      render: (_: unknown, r: Accessory, idx: number) => readOnly ? r.wastage : (
        <InputNumber size="small" value={r.wastage} onChange={(v) => updateAccessory(idx, { wastage: v ?? 5 })} min={0} max={100} className="w-full" />
      ),
    },
    {
      key: 'unit_price', title: '单价', dataIndex: 'unit_price', width: 90,
      render: (_: unknown, r: Accessory, idx: number) => readOnly ? toNum(r.unit_price).toFixed(2) : (
        <InputNumber size="small" value={r.unit_price} onChange={(v) => updateAccessory(idx, { unit_price: v || 0 })} min={0} step={0.01} className="w-full" />
      ),
    },
    {
      key: 'amount', title: '金额', width: 80,
      render: (_: unknown, r: Accessory) => calcAccessoryAmount({
        consumption: r.consumption ?? 1, wastage: r.wastage ?? 5, unitPrice: r.unit_price || 0,
      }).toFixed(2),
    },
    ...(!readOnly ? [{ key: 'action', title: '', width: 50, render: (_: unknown, __: Accessory, idx: number) => (
      <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeAccessory(idx)} />
    )}] : []),
  ];

  const fabricColumnsResized = useMemo(
    () => applyItemEditorColumnWidths(fabricColumns, fabricColWidths, FABRIC_COLUMN_DEFS, readOnly ? undefined : {
      onResize: handleFabricColResize,
      onResizeStop: handleFabricColResizeStop,
    }),
    [fabricColumns, fabricColWidths, readOnly, handleFabricColResize, handleFabricColResizeStop]
  );

  const accessoryColumnsResized = useMemo(
    () => applyItemEditorColumnWidths(accessoryColumns, accessoryColWidths, ACCESSORY_COLUMN_DEFS, readOnly ? undefined : {
      onResize: handleAccessoryColResize,
      onResizeStop: handleAccessoryColResizeStop,
    }),
    [accessoryColumns, accessoryColWidths, readOnly, handleAccessoryColResize, handleAccessoryColResizeStop]
  );

  const fabricScrollX = useMemo(() => estimateItemEditorScrollX(fabricColumnsResized), [fabricColumnsResized]);
  const accessoryScrollX = useMemo(() => estimateItemEditorScrollX(accessoryColumnsResized), [accessoryColumnsResized]);

  const productCodeTrimmed = productCode.trim();
  const versionItems = itemIndices.map((idx) => ({ index: idx, data: items[idx] })).filter((v) => v.data);

  const openVersionModal = () => {
    const current = items[activeItemIndex];
    const hasQty = (current?.quantity ?? 0) > 0;
    const hasLabor = (current?.labor_cost_usd ?? 0) > 0;
    setVersionRows([{
      version_label: '',
      quantity: hasQty ? current?.quantity : undefined,
      labor_cost_usd: hasLabor ? current?.labor_cost_usd : undefined,
    }]);
    setVersionModal(true);
  };

  const updateVersionRow = (rowIndex: number, patch: Partial<VersionRowDraft>) => {
    setVersionRows((prev) => prev.map((row, i) => (i === rowIndex ? { ...row, ...patch } : row)));
  };

  const addVersionRow = () => {
    setVersionRows((prev) => [...prev, { version_label: '' }]);
  };

  const removeVersionRow = (rowIndex: number) => {
    setVersionRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== rowIndex)));
  };

  const submitVersions = () => {
    if (versionRows.some((row) => !row.version_label.trim())) {
      message.warning('版本标签为必填项');
      return;
    }

    const rows = versionRows.map((row) => ({
      version_label: row.version_label.trim(),
      quantity: row.quantity,
      labor_cost_usd: row.labor_cost_usd,
    }));

    onAddVersions(activeItemIndex, rows);
    setVersionModal(false);
  };

  const switchVersion = (itemIndex: number, e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setActiveItemIndex(itemIndex);
  };

  const header = (
    <div className="flex items-center w-full pr-4">
      <Space wrap size={[8, 4]}>
        {productCodeTrimmed ? <Tag color="blue">{productCodeTrimmed}</Tag> : null}
        {productCodeTrimmed && versionItems.map(({ index: itemIndex, data }, versionIdx) => {
          const label = data.version_label?.trim();
          if (!label) return null;
          const isActive = itemIndex === activeItemIndex;
          return (
            <Button
              key={`${groupKey}-${itemIndex}`}
              size="small"
              className="version-switch-btn"
              style={getVersionButtonStyle(versionIdx, isActive)}
              onClick={(e) => switchVersion(itemIndex, e)}
            >
              {label}
            </Button>
          );
        })}
      </Space>
    </div>
  );

  const priceLabel = (
    <span className="text-brand-600 font-semibold tabular-nums">
      {currency === 'USD' ? '$' : '¥'}{cost.finalPrice.toFixed(2)}
    </span>
  );

  const quantityLaborShippingFields = (
    <>
      <FieldPermission fieldCode="item.quantity">
        <div>
          <label className="text-sm text-gray-500 mb-1 block">数量</label>
          {readOnly ? <span>{item.quantity}</span> : (
            <InputNumber size="small" className="w-full" value={item.quantity} onChange={(v) => update({ quantity: v || 0 })} min={0} />
          )}
        </div>
      </FieldPermission>
      <FieldPermission fieldCode="item.labor_cost_usd">
        <div>
          <label className="text-sm text-gray-500 mb-1 block">工价 (USD)</label>
          {readOnly ? <span>${toNum(item.labor_cost_usd).toFixed(2)}</span> : (
            <InputNumber size="small" className="w-full" value={item.labor_cost_usd} onChange={(v) => update({ labor_cost_usd: v || 0 })} min={0} step={0.01} prefix="$" />
          )}
          {!readOnly && (
            <p className="text-xs text-gray-400 mt-1">
              折算 RMB: ¥{(toNum(item.labor_cost_usd) * exchangeRate * 1.13).toFixed(2)}
            </p>
          )}
        </div>
      </FieldPermission>
      <FieldPermission fieldCode="item.shipping_rmb">
        <div>
          <label className="text-sm text-gray-500 mb-1 block">运费 (RMB)</label>
          {readOnly ? <span>¥{toNum(item.shipping_rmb).toFixed(2)}</span> : (
            <InputNumber size="small" className="w-full" value={item.shipping_rmb} onChange={(v) => update({ shipping_rmb: v ?? 1 })} min={0} step={0.01} prefix="¥" />
          )}
        </div>
      </FieldPermission>
    </>
  );

  const versionActions = !readOnly ? (
    <Button size="small" icon={<BranchesOutlined />} onClick={openVersionModal}>
      多版本
    </Button>
  ) : null;

  if (!item) return null;

  return (
    <>
    <Collapse
      defaultActiveKey={['1']}
      className="mb-4 bg-white rounded-xl shadow-card border border-gray-100 overflow-hidden"
      items={[{
        key: groupKey,
        label: header,
        extra: (
          <Space align="center" size="middle" onClick={(e) => e.stopPropagation()}>
            {priceLabel}
            {!readOnly && (
              <Button type="text" danger size="small" onClick={(e) => { e.stopPropagation(); onRemoveVersion(activeItemIndex); }}>
                删除
              </Button>
            )}
          </Space>
        ),
        children: (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <div className="xl:col-span-3 space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">面料明细</span>
                  {!readOnly && <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addFabric}>添加面料</Button>}
                </div>
                <Table
                  className="item-editor-table"
                  size="small"
                  pagination={false}
                  dataSource={item.fabrics || []}
                  columns={fabricColumnsResized}
                  rowKey={(_, i) => `f-${i}`}
                  scroll={{ x: fabricScrollX }}
                  components={readOnly ? undefined : TABLE_HEADER_COMPONENTS}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">辅料明细</span>
                  {!readOnly && <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addAccessory}>添加辅料</Button>}
                </div>
                <Table
                  className="item-editor-table"
                  size="small"
                  pagination={false}
                  dataSource={item.accessories || []}
                  columns={accessoryColumnsResized}
                  rowKey={(_, i) => `a-${i}`}
                  scroll={{ x: accessoryScrollX }}
                  components={readOnly ? undefined : TABLE_HEADER_COMPONENTS}
                />
              </div>

              <div>
                <label className="text-sm text-gray-500 mb-2 block">报价资料/排料图等附件</label>
                {readOnly ? (
                  itemAttachments.length > 0 ? (
                    <AttachmentPreviewList paths={itemAttachments} />
                  ) : (
                    <span className="text-gray-400">—</span>
                  )
                ) : (
                  <FileUpload
                    value={itemAttachments}
                    onChange={setItemAttachments}
                    maxCount={10}
                    hint="点击、拖拽或粘贴上传报价资料、排料图等附件"
                  />
                )}
              </div>
            </div>

            <div className="item-editor-side-panel">
              <div className="item-editor-side-fields mb-4 space-y-4">
                <div className="item-editor-side-field-row">
                  {quantityLaborShippingFields}
                </div>
                <div className="item-editor-side-action-row">
                  {versionActions}
                </div>
              </div>
              <CostSummary
                fabricTotal={cost.fabricTotal}
                accessoryTotal={cost.accessoryTotal}
                laborRmb={cost.laborRmb}
                otherCostRmb={item.other_cost_rmb || 0}
                shippingRmb={item.shipping_rmb ?? 1}
                subtotalRmb={cost.subtotalRmb}
                finalPrice={cost.finalPrice}
                currency={currency}
                profitMargin={profitMargin}
              />
            </div>
          </div>
        ),
      }]}
    />

    <Modal
      title="创建多版本"
      open={versionModal}
      onCancel={() => setVersionModal(false)}
      onOk={submitVersions}
      okText="确定"
      cancelText="取消"
      width={560}
      destroyOnClose
    >
      <div className="version-modal-table">
        <div className="version-modal-head">
          <span className="required">版本标签</span>
          <span>数量</span>
          <span>版本工价 (USD)</span>
          <span />
        </div>
        {versionRows.map((row, rowIndex) => (
          <div key={rowIndex} className="version-modal-row">
            <Input
              placeholder="如：彩条 / 素色"
              value={row.version_label}
              onChange={(e) => updateVersionRow(rowIndex, { version_label: e.target.value })}
            />
            <InputNumber
              className="w-full"
              min={0}
              placeholder="可选"
              value={row.quantity}
              onChange={(v) => updateVersionRow(rowIndex, { quantity: v ?? undefined })}
            />
            <InputNumber
              className="w-full"
              min={0}
              step={0.01}
              prefix="$"
              placeholder="可选"
              value={row.labor_cost_usd}
              onChange={(v) => updateVersionRow(rowIndex, { labor_cost_usd: v ?? undefined })}
            />
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={versionRows.length <= 1}
              onClick={() => removeVersionRow(rowIndex)}
            />
          </div>
        ))}
        <Button type="dashed" block icon={<PlusOutlined />} className="mt-3" onClick={addVersionRow}>
          添加版本
        </Button>
      </div>
    </Modal>
    </>
  );
}
