import { useState, useMemo } from 'react';
import {
  Input, InputNumber, Select, Button, Table, Collapse, Space, Modal, Tag, Spin, AutoComplete,
} from 'antd';
import { PlusOutlined, DeleteOutlined, BranchesOutlined, LineChartOutlined } from '@ant-design/icons';
import type { QuotationItem, Fabric, Accessory, QuantityTier } from '@/types';
import { createEmptyFabric, createEmptyAccessory, UNIT_LABELS } from '@/types';
import { calcItemCost, calcGrossWidth, calcNetWidth, calcFabricConsumption, calcAccessoryAmount } from '@/utils/calculation';
import { toNum } from '@/utils/normalize';
import CostSummary from '@/components/CostSummary';
import FileUpload from '@/components/FileUpload';
import AttachmentPreviewList from '@/components/AttachmentPreviewList';
import { FieldPermission } from '@/components/FieldPermission';

interface ItemEditorProps {
  item: QuotationItem;
  index: number;
  exchangeRate: number;
  currency: 'RMB' | 'USD';
  profitMargin: number;
  fabricOptions: Array<{ value: number; label: string; data: Fabric; use_count?: number }>;
  accessoryOptions: Array<{ value: number; label: string; data: Accessory; use_count?: number }>;
  defaultWastage?: number;
  optionsReady?: boolean;
  onChange: (item: QuotationItem) => void;
  onRemove: () => void;
  readOnly?: boolean;
}

export default function ItemEditor({
  item, index, exchangeRate, currency, profitMargin,
  fabricOptions, accessoryOptions, defaultWastage = 5, optionsReady = true,
  onChange, onRemove, readOnly,
}: ItemEditorProps) {
  const [tierModal, setTierModal] = useState(false);
  const [tiers, setTiers] = useState<QuantityTier[]>(item.quantity_tiers || []);

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

  const update = (patch: Partial<QuotationItem>) => onChange({ ...item, ...patch });

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

  const fabricSelectNotFound = optionsReady ? '暂无数据' : <Spin size="small" />;

  const fabricColumns = [
    {
      title: '面料', dataIndex: 'name', width: 180,
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
      title: '成分', dataIndex: 'composition', width: 120,
      render: (_: unknown, r: Fabric, idx: number) => readOnly ? r.composition : (
        <Input size="small" value={r.composition} onChange={(e) => updateFabric(idx, { composition: e.target.value })} />
      ),
    },
    {
      title: '克重(g/m²)', dataIndex: 'weight', width: 100,
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
      title: '净门幅(厘米)', dataIndex: 'net_width', width: 110,
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
      title: '毛门幅(厘米)', dataIndex: 'gross_width', width: 110,
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
      title: '单位', dataIndex: 'unit', width: 90,
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
      title: '段长(厘米)', dataIndex: 'piece_length', width: 100,
      render: (_: unknown, r: Fabric, idx: number) => readOnly ? r.piece_length : (
        <InputNumber size="small" value={r.piece_length} onChange={(v) => updateFabric(idx, { piece_length: v || 0 })} min={0} step={0.01} className="w-full" addonAfter="cm" />
      ),
    },
    {
      title: '损耗%', dataIndex: 'wastage', width: 80,
      render: (_: unknown, r: Fabric, idx: number) => readOnly ? r.wastage : (
        <InputNumber size="small" value={r.wastage} onChange={(v) => updateFabric(idx, { wastage: v ?? 5 })} min={0} max={100} className="w-full" />
      ),
    },
    {
      title: '单耗', width: 80,
      render: (_: unknown, r: Fabric) => calcFabricConsumption(toFabricCalcInput(r)).toFixed(2),
    },
    {
      title: '单价', dataIndex: 'unit_price', width: 90,
      render: (_: unknown, r: Fabric, idx: number) => readOnly ? toNum(r.unit_price).toFixed(2) : (
        <InputNumber size="small" value={r.unit_price} onChange={(v) => updateFabric(idx, { unit_price: v || 0 })} min={0} step={0.01} className="w-full" />
      ),
    },
    {
      title: '金额', width: 80,
      render: (_: unknown, r: Fabric) => {
        const input = toFabricCalcInput(r);
        const c = calcFabricConsumption(input);
        return (c * (r.unit_price || 0)).toFixed(2);
      },
    },
    ...(!readOnly ? [{ title: '', width: 50, render: (_: unknown, __: Fabric, idx: number) => (
      <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeFabric(idx)} />
    )}] : []),
  ];

  const accessoryColumns = [
    {
      title: '辅料', dataIndex: 'name', width: 160,
      render: (_: unknown, __: Accessory, idx: number) => readOnly ? item.accessories?.[idx]?.name : (
        <Select
          showSearch
          placeholder="选择辅料"
          className="w-full"
          value={item.accessories?.[idx]?.accessory_id}
          onChange={(v) => selectAccessory(idx, v)}
          loading={!optionsReady}
          notFoundContent={fabricSelectNotFound}
          options={accessoryOptions.map((o) => ({ value: o.value, label: o.label }))}
          filterOption={(input, option) => {
            const opt = accessoryOptions.find((o) => o.value === option?.value);
            return opt?.label.toLowerCase().includes(input.toLowerCase()) ?? false;
          }}
        />
      ),
    },
    {
      title: '规格', dataIndex: 'specification', width: 140,
      render: (_: unknown, r: Accessory, idx: number) => readOnly ? r.specification : (
        <Input size="small" value={r.specification} onChange={(e) => updateAccessory(idx, { specification: e.target.value })} placeholder="如：3#拉链，铜色" />
      ),
    },
    {
      title: '单耗', dataIndex: 'consumption', width: 80,
      render: (_: unknown, r: Accessory, idx: number) => readOnly ? r.consumption : (
        <InputNumber size="small" value={r.consumption} onChange={(v) => updateAccessory(idx, { consumption: v ?? 1 })} min={0} step={0.01} className="w-full" />
      ),
    },
    {
      title: '损耗%', dataIndex: 'wastage', width: 80,
      render: (_: unknown, r: Accessory, idx: number) => readOnly ? r.wastage : (
        <InputNumber size="small" value={r.wastage} onChange={(v) => updateAccessory(idx, { wastage: v ?? 5 })} min={0} max={100} className="w-full" />
      ),
    },
    {
      title: '单价', dataIndex: 'unit_price', width: 90,
      render: (_: unknown, r: Accessory, idx: number) => readOnly ? toNum(r.unit_price).toFixed(2) : (
        <InputNumber size="small" value={r.unit_price} onChange={(v) => updateAccessory(idx, { unit_price: v || 0 })} min={0} step={0.01} className="w-full" />
      ),
    },
    {
      title: '金额', width: 80,
      render: (_: unknown, r: Accessory) => calcAccessoryAmount({
        consumption: r.consumption ?? 1, wastage: r.wastage ?? 5, unitPrice: r.unit_price || 0,
      }).toFixed(2),
    },
    ...(!readOnly ? [{ title: '', width: 50, render: (_: unknown, __: Accessory, idx: number) => (
      <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeAccessory(idx)} />
    )}] : []),
  ];

  const header = (
    <div className="flex items-center justify-between w-full pr-4">
      <Space>
        <span className="font-medium">明细行 {index + 1}</span>
        {item.product_code && <Tag>{item.product_code}</Tag>}
        {item.version_label && <Tag color="purple">{item.version_label}</Tag>}
        {item.version && item.version > 1 && <Tag color="orange">V{item.version}</Tag>}
      </Space>
      <span className="text-brand-600 font-semibold">
        {currency === 'USD' ? '$' : '¥'}{cost.finalPrice.toFixed(2)}
      </span>
    </div>
  );

  return (
    <>
    <Collapse
      defaultActiveKey={['1']}
      className="mb-4 bg-white rounded-xl shadow-card border border-gray-100 overflow-hidden"
      items={[{
        key: '1',
        label: header,
        extra: !readOnly && (
          <Button type="text" danger size="small" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
            删除
          </Button>
        ),
        children: (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <div className="xl:col-span-3 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <FieldPermission fieldCode="item.product_code">
                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">款号</label>
                    {readOnly ? <span>{item.product_code}</span> : (
                      <Input value={item.product_code} onChange={(e) => update({ product_code: e.target.value })} />
                    )}
                  </div>
                </FieldPermission>
                <FieldPermission fieldCode="item.quantity">
                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">数量</label>
                    {readOnly ? <span>{item.quantity}</span> : (
                      <InputNumber className="w-full" value={item.quantity} onChange={(v) => update({ quantity: v || 0 })} min={0} />
                    )}
                  </div>
                </FieldPermission>
                <FieldPermission fieldCode="item.labor_cost_usd">
                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">工价 (USD)</label>
                    {readOnly ? <span>${toNum(item.labor_cost_usd).toFixed(2)}</span> : (
                      <InputNumber className="w-full" value={item.labor_cost_usd} onChange={(v) => update({ labor_cost_usd: v || 0 })} min={0} step={0.01} prefix="$" />
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
                      <InputNumber className="w-full" value={item.shipping_rmb} onChange={(v) => update({ shipping_rmb: v ?? 1 })} min={0} step={0.01} prefix="¥" />
                    )}
                  </div>
                </FieldPermission>
              </div>

              {!readOnly && (
                <Space>
                  {!item.showVersionLabel && (
                    <Button size="small" icon={<BranchesOutlined />} onClick={() => update({ showVersionLabel: true })}>
                      多版本
                    </Button>
                  )}
                  {item.showVersionLabel && (
                    <Input
                      placeholder="版本标签，如：彩条/素色"
                      value={item.version_label}
                      onChange={(e) => update({ version_label: e.target.value })}
                      style={{ width: 200 }}
                    />
                  )}
                  <Button size="small" icon={<LineChartOutlined />} onClick={() => { setTiers(item.quantity_tiers || []); setTierModal(true); }}>
                    阶梯价
                  </Button>
                </Space>
              )}

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">面料明细</span>
                  {!readOnly && <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addFabric}>添加面料</Button>}
                </div>
                <Table size="small" pagination={false} dataSource={item.fabrics || []} columns={fabricColumns} rowKey={(_, i) => `f-${i}`} scroll={{ x: 1300 }} />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">辅料明细</span>
                  {!readOnly && <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addAccessory}>添加辅料</Button>}
                </div>
                <Table size="small" pagination={false} dataSource={item.accessories || []} columns={accessoryColumns} rowKey={(_, i) => `a-${i}`} scroll={{ x: 800 }} />
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

            <div>
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
      title="数量阶梯价"
      open={tierModal}
      onOk={() => { update({ quantity_tiers: tiers }); setTierModal(false); }}
      onCancel={() => setTierModal(false)}
      width={600}
    >
      {tiers.map((tier, i) => (
        <Space key={i} className="mb-2 w-full" align="center">
          <InputNumber placeholder="最小数量" value={tier.min_qty} onChange={(v) => { const t = [...tiers]; t[i] = { ...t[i], min_qty: v || 0 }; setTiers(t); }} />
          <span>-</span>
          <InputNumber placeholder="最大数量" value={tier.max_qty} onChange={(v) => { const t = [...tiers]; t[i] = { ...t[i], max_qty: v || undefined }; setTiers(t); }} />
          <InputNumber placeholder="价格" value={tier.price} onChange={(v) => { const t = [...tiers]; t[i] = { ...t[i], price: v || 0 }; setTiers(t); }} prefix="¥" />
          <Button danger type="text" icon={<DeleteOutlined />} onClick={() => setTiers(tiers.filter((_, j) => j !== i))} />
        </Space>
      ))}
      <Button type="dashed" block icon={<PlusOutlined />} onClick={() => setTiers([...tiers, { min_qty: 0, price: 0 }])}>
        添加阶梯
      </Button>
    </Modal>
    </>
  );
}
