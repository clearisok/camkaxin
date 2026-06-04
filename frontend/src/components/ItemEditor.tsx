import { useState, useMemo } from 'react';
import {
  Input, InputNumber, Select, Button, Table, Collapse, Space, Modal, Tag, Tooltip,
} from 'antd';
import { PlusOutlined, DeleteOutlined, BranchesOutlined, LineChartOutlined } from '@ant-design/icons';
import type { QuotationItem, Fabric, Accessory, QuantityTier } from '@/types';
import { createEmptyFabric, createEmptyAccessory } from '@/types';
import { calcItemCost, calcGrossWidth, calcFabricConsumption, calcAccessoryAmount } from '@/utils/calculation';
import CostSummary from '@/components/CostSummary';
import FileUpload from '@/components/FileUpload';
import { FieldPermission } from '@/components/FieldPermission';

interface ItemEditorProps {
  item: QuotationItem;
  index: number;
  exchangeRate: number;
  currency: 'RMB' | 'USD';
  profitMargin: number;
  fabricOptions: Array<{ value: number; label: string; data: Fabric; use_count?: number }>;
  accessoryOptions: Array<{ value: number; label: string; data: Accessory; use_count?: number }>;
  onChange: (item: QuotationItem) => void;
  onRemove: () => void;
  readOnly?: boolean;
}

export default function ItemEditor({
  item, index, exchangeRate, currency, profitMargin,
  fabricOptions, accessoryOptions, onChange, onRemove, readOnly,
}: ItemEditorProps) {
  const [tierModal, setTierModal] = useState(false);
  const [tiers, setTiers] = useState<QuantityTier[]>(item.quantity_tiers || []);

  const cost = useMemo(() => {
    return calcItemCost(
      {
        laborCostUsd: item.labor_cost_usd || 0,
        otherCostRmb: item.other_cost_rmb || 0,
        shippingRmb: item.shipping_rmb ?? 1,
        fabrics: (item.fabrics || []).map((f) => ({
          pieceLength: f.piece_length || 0,
          wastage: f.wastage ?? 5,
          unit: f.unit || 'meter',
          netWidth: f.net_width || 0,
          weight: f.weight || 0,
          unitPrice: f.unit_price || 0,
        })),
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

  const addFabric = () => update({ fabrics: [...(item.fabrics || []), createEmptyFabric()] });
  const updateFabric = (idx: number, patch: Partial<Fabric>) => {
    const fabrics = [...(item.fabrics || [])];
    fabrics[idx] = { ...fabrics[idx], ...patch };
    if (patch.net_width !== undefined) {
      fabrics[idx].gross_width = calcGrossWidth(patch.net_width);
    }
    update({ fabrics });
  };
  const removeFabric = (idx: number) => update({ fabrics: (item.fabrics || []).filter((_, i) => i !== idx) });

  const selectFabric = (idx: number, fabricId: number) => {
    const opt = fabricOptions.find((o) => o.value === fabricId);
    if (opt) {
      updateFabric(idx, {
        fabric_id: fabricId,
        name: opt.data.name,
        composition: opt.data.composition,
        weight: opt.data.weight,
        net_width: opt.data.net_width,
        gross_width: calcGrossWidth(opt.data.net_width || 0),
        unit: opt.data.unit,
        unit_price: opt.data.reference_price || opt.data.unit_price,
      });
    }
  };

  const addAccessory = () => update({ accessories: [...(item.accessories || []), createEmptyAccessory()] });
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
        unit_price: opt.data.reference_price || opt.data.unit_price,
      });
    }
  };

  const fabricColumns = [
    {
      title: '面料', dataIndex: 'name', width: 180,
      render: (_: unknown, __: Fabric, idx: number) => readOnly ? item.fabrics?.[idx]?.name : (
        <Select
          showSearch
          placeholder="选择或输入"
          className="w-full"
          value={item.fabrics?.[idx]?.fabric_id}
          onChange={(v) => selectFabric(idx, v)}
          options={fabricOptions.map((o) => ({
            value: o.value,
            label: (
              <span>{o.label}{o.use_count ? <Tag className="ml-1" color="blue">{o.use_count}</Tag> : null}</span>
            ),
          }))}
          filterOption={(input, option) => {
            const opt = fabricOptions.find((o) => o.value === option?.value);
            return opt?.label.toLowerCase().includes(input.toLowerCase()) ?? false;
          }}
        />
      ),
    },
    { title: '段长', dataIndex: 'piece_length', width: 90, render: (_: unknown, r: Fabric, idx: number) => readOnly ? r.piece_length : (
      <InputNumber size="small" value={r.piece_length} onChange={(v) => updateFabric(idx, { piece_length: v || 0 })} min={0} step={0.01} className="w-full" />
    )},
    { title: '损耗%', dataIndex: 'wastage', width: 80, render: (_: unknown, r: Fabric, idx: number) => readOnly ? r.wastage : (
      <InputNumber size="small" value={r.wastage} onChange={(v) => updateFabric(idx, { wastage: v ?? 5 })} min={0} max={100} className="w-full" />
    )},
    { title: '单耗', width: 80, render: (_: unknown, r: Fabric) => calcFabricConsumption({
      pieceLength: r.piece_length || 0, wastage: r.wastage ?? 5, unit: r.unit || 'meter',
      netWidth: r.net_width || 0, weight: r.weight || 0, unitPrice: 0,
    }).toFixed(2) },
    { title: '单价', dataIndex: 'unit_price', width: 90, render: (_: unknown, r: Fabric, idx: number) => readOnly ? r.unit_price?.toFixed(2) : (
      <InputNumber size="small" value={r.unit_price} onChange={(v) => updateFabric(idx, { unit_price: v || 0 })} min={0} step={0.01} className="w-full" />
    )},
    { title: '金额', width: 80, render: (_: unknown, r: Fabric) => {
      const c = calcFabricConsumption({ pieceLength: r.piece_length || 0, wastage: r.wastage ?? 5, unit: r.unit || 'meter', netWidth: r.net_width || 0, weight: r.weight || 0, unitPrice: r.unit_price || 0 });
      return (c * (r.unit_price || 0)).toFixed(2);
    }},
    ...(!readOnly ? [{ title: '', width: 50, render: (_: unknown, __: Fabric, idx: number) => (
      <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeFabric(idx)} />
    )}] : []),
  ];

  const accessoryColumns = [
    {
      title: '辅料', dataIndex: 'name', width: 180,
      render: (_: unknown, __: Accessory, idx: number) => readOnly ? item.accessories?.[idx]?.name : (
        <Select showSearch placeholder="选择辅料" className="w-full" value={item.accessories?.[idx]?.accessory_id}
          onChange={(v) => selectAccessory(idx, v)}
          options={accessoryOptions.map((o) => ({ value: o.value, label: o.label }))} />
      ),
    },
    { title: '单耗', dataIndex: 'consumption', width: 80, render: (_: unknown, r: Accessory, idx: number) => readOnly ? r.consumption : (
      <InputNumber size="small" value={r.consumption} onChange={(v) => updateAccessory(idx, { consumption: v ?? 1 })} min={0} step={0.01} className="w-full" />
    )},
    { title: '损耗%', dataIndex: 'wastage', width: 80, render: (_: unknown, r: Accessory, idx: number) => readOnly ? r.wastage : (
      <InputNumber size="small" value={r.wastage} onChange={(v) => updateAccessory(idx, { wastage: v ?? 5 })} min={0} max={100} className="w-full" />
    )},
    { title: '单价', dataIndex: 'unit_price', width: 90, render: (_: unknown, r: Accessory, idx: number) => readOnly ? r.unit_price?.toFixed(2) : (
      <InputNumber size="small" value={r.unit_price} onChange={(v) => updateAccessory(idx, { unit_price: v || 0 })} min={0} step={0.01} className="w-full" />
    )},
    { title: '金额', width: 80, render: (_: unknown, r: Accessory) => calcAccessoryAmount({ consumption: r.consumption ?? 1, wastage: r.wastage ?? 5, unitPrice: r.unit_price || 0 }).toFixed(2) },
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
                    {readOnly ? <span>${item.labor_cost_usd?.toFixed(2)}</span> : (
                      <InputNumber className="w-full" value={item.labor_cost_usd} onChange={(v) => update({ labor_cost_usd: v || 0 })} min={0} step={0.01} prefix="$" />
                    )}
                  </div>
                </FieldPermission>
                <FieldPermission fieldCode="item.shipping_rmb">
                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">运费 (RMB)</label>
                    {readOnly ? <span>¥{item.shipping_rmb?.toFixed(2)}</span> : (
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
                <Table size="small" pagination={false} dataSource={item.fabrics || []} columns={fabricColumns} rowKey={(_, i) => `f-${i}`} scroll={{ x: 700 }} />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">辅料明细</span>
                  {!readOnly && <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addAccessory}>添加辅料</Button>}
                </div>
                <Table size="small" pagination={false} dataSource={item.accessories || []} columns={accessoryColumns} rowKey={(_, i) => `a-${i}`} scroll={{ x: 600 }} />
              </div>

              {!readOnly && (
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">款式图 / 附件</label>
                  <FileUpload
                    value={item.style_image ? [item.style_image] : []}
                    onChange={(paths) => update({ style_image: paths[0] })}
                    maxCount={1}
                  />
                </div>
              )}
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
