import { useEffect, useState, useMemo, type ReactNode } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Form, Select, DatePicker, InputNumber, Input, Button, Tag, message, Spin, Space, Radio,
} from 'antd';
import { SaveOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { beijingNow } from '@/utils/beijingTime';
import {
  getQuotation, createQuotation, updateQuotation,
  getBrands, getFabrics, getAccessories, getSettings,
  getBrandDefaultAccessories, trackBrandUsage,
} from '@/api';
import type { Quotation, QuotationItem, Brand, Fabric, Accessory } from '@/types';

type BrandLinkedAgent = NonNullable<Brand['agents']>[number];
import { createEmptyItem } from '@/types';
import { normalizeQuotationFromApi, roundRate } from '@/utils/normalize';
import ItemEditor from '@/components/ItemEditor';
import StyleImageUpload from '@/components/StyleImageUpload';
import PageHeader from '@/components/PageHeader';
import { FieldPermission } from '@/components/FieldPermission';

const REMARKS_PLACEHOLDER = '着重填写：面料特性/部位情况(如口袋/门襟/裤耳等)/工艺';

function BasicField({
  label,
  required,
  children,
  className = '',
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`quotation-basic-field ${className}`}>
      <label className="quotation-basic-label">
        {label}
        {required ? <span className="text-red-500 ml-0.5">*</span> : null}
      </label>
      <div className="quotation-basic-control">{children}</div>
    </div>
  );
}

function formatOptionalPrice(value?: number): string {
  return value != null && !Number.isNaN(value) ? value.toFixed(2) : '—';
}

export default function QuotationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = location.pathname.endsWith('/edit') || !id;
  const isNew = !id;
  const readOnly = !!id && !location.pathname.endsWith('/edit');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [exchangeRate, setExchangeRate] = useState(6.8);
  const [optionsReady, setOptionsReady] = useState(false);
  const [agentDefaultWastage, setAgentDefaultWastage] = useState(5);
  const [brandAgents, setBrandAgents] = useState<BrandLinkedAgent[]>([]);

  const [form, setForm] = useState<Quotation>({
    currency: 'RMB',
    exchange_rate: 6.8,
    profit_margin: 5,
    quote_date: beijingNow().format('YYYY-MM-DD'),
    status: 'draft',
    items: [createEmptyItem()],
  });

  const syncBrandAgents = (brandId?: number, currentAgentName?: string) => {
    const brand = brands.find((b) => b.id === brandId);
    const linked = brand?.agents || [];
    setBrandAgents(linked);
    const matched = linked.find((a) => a.name === currentAgentName);
    if (matched?.default_wastage != null) {
      setAgentDefaultWastage(matched.default_wastage);
    } else if (linked.length === 1 && linked[0].default_wastage != null) {
      setAgentDefaultWastage(linked[0].default_wastage);
    }
    return linked;
  };

  useEffect(() => {
    if (form.brand_id && brands.length > 0) {
      syncBrandAgents(form.brand_id, form.agent_name);
    }
  }, [form.brand_id, form.agent_name, brands]);

  useEffect(() => {
    setOptionsReady(false);
    Promise.all([getBrands(), getFabrics(), getAccessories(), getSettings()])
      .then(([b, f, a, s]) => {
        setBrands(b.data || []);
        setFabrics(f.data || []);
        setAccessories(a.data || []);
        const rate = roundRate(s.data?.usd_to_rmb_rate, 6.8);
        setExchangeRate(rate);
        if (isNew) {
          setForm((prev) => ({ ...prev, exchange_rate: rate }));
        }
      }).catch((loadErr) => {
        // #region agent log
        fetch('http://127.0.0.1:7866/ingest/949bb3a4-1e98-433b-8c2f-5ab46646876f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6f51ef'},body:JSON.stringify({sessionId:'6f51ef',location:'QuotationForm.tsx:loadOptions',message:'Promise.all load failed',data:{error:String(loadErr),name:(loadErr as Error)?.name},timestamp:Date.now(),hypothesisId:'E',runId:'pre-fix'})}).catch(()=>{});
        // #endregion
        message.error((loadErr as Error).message || '加载选项失败');
      })
      .finally(() => setOptionsReady(true));

    if (id) {
      setLoading(true);
      getQuotation(parseInt(id, 10))
        .then((data) => {
          const normalized = normalizeQuotationFromApi(data as Record<string, unknown>);
          setForm({
            ...(normalized as Quotation),
            items: normalized.items?.length ? (normalized.items as QuotationItem[]) : [createEmptyItem()],
          });
        })
        .catch((err) => message.error(String(err)))
        .finally(() => setLoading(false));
    }
  }, [id, isNew]);

  const fabricOptions = useMemo(() =>
    fabrics.map((f) => ({
      value: f.id!,
      label: f.name,
      data: f,
      use_count: f.use_count,
    })), [fabrics]);

  const accessoryOptions = useMemo(() =>
    accessories.map((a) => ({
      value: a.id!,
      label: a.name,
      data: a,
      use_count: a.use_count,
    })), [accessories]);

  const applyAgent = (agent: BrandLinkedAgent | undefined) => {
    if (!agent) return;
    setAgentDefaultWastage(agent.default_wastage ?? 5);
    setForm((prev) => ({ ...prev, agent_name: agent.name }));
  };

  const handleBrandChange = async (brandId: number) => {
    const linked = syncBrandAgents(brandId);
    const defaultAgent = linked.length === 1 ? linked[0] : undefined;
    const wastage = defaultAgent?.default_wastage ?? agentDefaultWastage;
    if (defaultAgent) {
      setAgentDefaultWastage(defaultAgent.default_wastage ?? 5);
    }

    let brandAccessories: Accessory[] | undefined;
    try {
      await trackBrandUsage(brandId);
      const res = await getBrandDefaultAccessories(brandId);
      const defaultAccs = res.data || [];
      if (defaultAccs.length > 0) {
        brandAccessories = defaultAccs.map((a: Accessory) => {
          const matched = accessories.find((lib) => lib.name === a.name);
          return {
            accessory_id: matched?.id,
            name: a.name,
            specification: a.specification || matched?.specification,
            consumption: a.consumption ?? 1,
            wastage: a.wastage ?? wastage,
            unit_price: a.unit_price ?? matched?.reference_price ?? 0,
          };
        });
      }
    } catch { /* ignore */ }

    setForm((prev) => {
      const items = [...(prev.items || [])];
      if (brandAccessories?.length && items.length) {
        items[0] = { ...items[0], accessories: brandAccessories };
      }
      return {
        ...prev,
        brand_id: brandId,
        agent_name: defaultAgent?.name || '',
        items,
      };
    });
  };

  const handleAgentChange = (agentName: string) => {
    const agent = brandAgents.find((a) => a.name === agentName);
    applyAgent(agent);
  };

  const updateItem = (index: number, item: QuotationItem) => {
    const items = [...(form.items || [])];
    items[index] = item;
    setForm((prev) => ({ ...prev, items }));
  };

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...(prev.items || []), createEmptyItem()],
    }));
  };

  const removeItem = (index: number) => {
    if ((form.items?.length || 0) <= 1) {
      message.warning('至少保留一条明细');
      return;
    }
    setForm((prev) => ({
      ...prev,
      items: prev.items?.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (!form.brand_id) {
      message.warning('请选择品牌');
      return;
    }
    if (brandAgents.length > 0 && !form.agent_name) {
      message.warning('请选择业务员');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        exchange_rate: roundRate(form.exchange_rate, exchangeRate),
        quote_date: form.quote_date,
        fabric_delivery_date: form.fabric_delivery_date,
        garment_delivery_date: form.garment_delivery_date,
      };

      if (isNew) {
        const res = await createQuotation(payload);
        message.success('创建成功');
        navigate(`/quotations/${res.id}/edit`);
      } else {
        await updateQuotation(parseInt(id!, 10), payload);
        message.success('保存成功');
      }
    } catch (err) {
      message.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-96"><Spin size="large" /></div>;
  }

  return (
    <div className="page-container">
      <PageHeader
        title={isNew ? '新建报价单' : readOnly ? '查看报价单' : '编辑报价单'}
        subtitle={form.quotation_no}
        onBack={isNew ? undefined : () => navigate('/quotations')}
        extra={!readOnly && (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            保存
          </Button>
        )}
      />

      <div className="card-panel mb-6 quotation-basic-panel">
        <h2 className="section-title">基本信息</h2>

        <div className="quotation-basic-section">
          <h3 className="quotation-basic-section-title">客户与日期</h3>
          <div className="quotation-basic-grid quotation-basic-grid-4">
            <FieldPermission fieldCode="quotation.brand_id">
              <BasicField label="品牌" required>
                {readOnly ? <span className="quotation-basic-value">{form.brand_name}</span> : (
                  <Select
                    showSearch
                    placeholder="选择品牌"
                    className="w-full"
                    value={form.brand_id}
                    onChange={handleBrandChange}
                    options={brands.map((b) => ({
                      value: b.id,
                      label: (
                        <span>
                          {b.name}
                          {b.use_count ? <Tag className="ml-1" color="blue">{b.use_count}次</Tag> : null}
                        </span>
                      ),
                    }))}
                    filterOption={(input, option) =>
                      brands.find((b) => b.id === option?.value)?.name.toLowerCase().includes(input.toLowerCase()) ?? false
                    }
                  />
                )}
              </BasicField>
            </FieldPermission>

            <FieldPermission fieldCode="quotation.agent_name">
              <BasicField label="业务员" required>
                {readOnly ? (
                  <span className="quotation-basic-value">{form.agent_name || '—'}</span>
                ) : (
                  <Select
                    className="w-full"
                    placeholder={form.brand_id ? '选择业务员' : '请先选择品牌'}
                    disabled={!form.brand_id || brandAgents.length === 0}
                    value={form.agent_name || undefined}
                    onChange={handleAgentChange}
                    options={brandAgents.map((a) => ({ value: a.name, label: a.name }))}
                  />
                )}
              </BasicField>
            </FieldPermission>

            <FieldPermission fieldCode="quotation.quote_date">
              <BasicField label="报价日期">
                {readOnly ? <span className="quotation-basic-value">{form.quote_date}</span> : (
                  <DatePicker
                    className="w-full"
                    value={form.quote_date ? dayjs(form.quote_date) : beijingNow()}
                    onChange={(d) => {
                      if (d) {
                        setForm((prev) => ({ ...prev, quote_date: d.format('YYYY-MM-DD') }));
                      }
                    }}
                  />
                )}
              </BasicField>
            </FieldPermission>

            <FieldPermission fieldCode="quotation.status">
              <BasicField label="状态">
                {readOnly ? <Tag>{form.status}</Tag> : (
                  <Select
                    className="w-full"
                    value={form.status}
                    onChange={(v) => setForm((prev) => ({ ...prev, status: v }))}
                    options={[
                      { value: 'draft', label: '草稿' },
                      { value: 'sent', label: '已发送' },
                      { value: 'confirmed', label: '已确认' },
                      { value: 'expired', label: '已过期' },
                    ]}
                  />
                )}
              </BasicField>
            </FieldPermission>
          </div>
        </div>

        <div className="quotation-basic-section">
          <h3 className="quotation-basic-section-title">交期与报价参数</h3>
          <div className="quotation-basic-grid quotation-basic-grid-4">
            <FieldPermission fieldCode="quotation.fabric_delivery_date">
              <BasicField label="面料交期">
                {readOnly ? <span className="quotation-basic-value">{form.fabric_delivery_date || '—'}</span> : (
                  <DatePicker
                    className="w-full"
                    value={form.fabric_delivery_date ? dayjs(form.fabric_delivery_date) : undefined}
                    onChange={(d) => setForm((prev) => ({
                      ...prev,
                      fabric_delivery_date: d ? d.format('YYYY-MM-DD') : undefined,
                    }))}
                  />
                )}
              </BasicField>
            </FieldPermission>

            <FieldPermission fieldCode="quotation.garment_delivery_date">
              <BasicField label="成衣交期">
                {readOnly ? <span className="quotation-basic-value">{form.garment_delivery_date || '—'}</span> : (
                  <DatePicker
                    className="w-full"
                    value={form.garment_delivery_date ? dayjs(form.garment_delivery_date) : undefined}
                    onChange={(d) => setForm((prev) => ({
                      ...prev,
                      garment_delivery_date: d ? d.format('YYYY-MM-DD') : undefined,
                    }))}
                  />
                )}
              </BasicField>
            </FieldPermission>

            <FieldPermission fieldCode="quotation.currency">
              <BasicField label="报价币种">
                {readOnly ? <span className="quotation-basic-value">{form.currency}</span> : (
                  <Radio.Group
                    value={form.currency}
                    onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}
                    options={[{ value: 'RMB', label: 'RMB' }, { value: 'USD', label: 'USD' }]}
                  />
                )}
              </BasicField>
            </FieldPermission>

            <FieldPermission fieldCode="quotation.exchange_rate">
              <BasicField label="汇率 (USD→RMB)">
                {readOnly ? <span className="quotation-basic-value">{roundRate(form.exchange_rate).toFixed(2)}</span> : (
                  <InputNumber
                    className="w-full"
                    value={form.exchange_rate}
                    onChange={(v) => setForm((prev) => ({ ...prev, exchange_rate: roundRate(v, exchangeRate) }))}
                    min={0}
                    step={0.01}
                    precision={2}
                  />
                )}
              </BasicField>
            </FieldPermission>

            <FieldPermission fieldCode="quotation.profit_margin">
              <BasicField label="利润率 (%)">
                {readOnly ? <span className="quotation-basic-value">{form.profit_margin}%</span> : (
                  <InputNumber
                    className="w-full"
                    value={form.profit_margin}
                    onChange={(v) => setForm((prev) => ({ ...prev, profit_margin: v ?? 5 }))}
                    min={0}
                    max={100}
                  />
                )}
              </BasicField>
            </FieldPermission>
          </div>
        </div>

        <div className="quotation-basic-section">
          <h3 className="quotation-basic-section-title">目标与确认价格</h3>
          <div className="quotation-basic-grid quotation-basic-grid-4">
            <FieldPermission fieldCode="quotation.target_labor_price">
              <BasicField label="目标工价">
                {readOnly ? <span className="quotation-basic-value">{formatOptionalPrice(form.target_labor_price)}</span> : (
                  <InputNumber
                    className="w-full"
                    value={form.target_labor_price}
                    onChange={(v) => setForm((prev) => ({ ...prev, target_labor_price: v ?? undefined }))}
                    min={0}
                    step={0.01}
                    precision={2}
                  />
                )}
              </BasicField>
            </FieldPermission>

            <FieldPermission fieldCode="quotation.target_garment_price">
              <BasicField label="目标成衣价格">
                {readOnly ? <span className="quotation-basic-value">{formatOptionalPrice(form.target_garment_price)}</span> : (
                  <InputNumber
                    className="w-full"
                    value={form.target_garment_price}
                    onChange={(v) => setForm((prev) => ({ ...prev, target_garment_price: v ?? undefined }))}
                    min={0}
                    step={0.01}
                    precision={2}
                  />
                )}
              </BasicField>
            </FieldPermission>

            <FieldPermission fieldCode="quotation.confirmed_labor_price">
              <BasicField label="确认工价">
                {readOnly ? <span className="quotation-basic-value">{formatOptionalPrice(form.confirmed_labor_price)}</span> : (
                  <InputNumber
                    className="w-full"
                    value={form.confirmed_labor_price}
                    onChange={(v) => setForm((prev) => ({ ...prev, confirmed_labor_price: v ?? undefined }))}
                    min={0}
                    step={0.01}
                    precision={2}
                  />
                )}
              </BasicField>
            </FieldPermission>

            <FieldPermission fieldCode="quotation.confirmed_garment_price">
              <BasicField label="确认成衣价格">
                {readOnly ? <span className="quotation-basic-value">{formatOptionalPrice(form.confirmed_garment_price)}</span> : (
                  <InputNumber
                    className="w-full"
                    value={form.confirmed_garment_price}
                    onChange={(v) => setForm((prev) => ({ ...prev, confirmed_garment_price: v ?? undefined }))}
                    min={0}
                    step={0.01}
                    precision={2}
                  />
                )}
              </BasicField>
            </FieldPermission>
          </div>
        </div>

        <div className="quotation-basic-section quotation-basic-supplement">
          <h3 className="quotation-basic-section-title">补充信息</h3>
          <div className="quotation-basic-supplement-grid">
            <FieldPermission fieldCode="quotation.style_image">
              <BasicField label="款式图" className="quotation-basic-style-field">
                <StyleImageUpload
                  value={form.style_image}
                  onChange={(path) => setForm((prev) => ({ ...prev, style_image: path }))}
                  readOnly={readOnly}
                />
              </BasicField>
            </FieldPermission>

            <FieldPermission fieldCode="quotation.remarks">
              <BasicField label="备注" className="quotation-basic-remarks-field">
                {readOnly ? (
                  <p className="quotation-basic-value quotation-basic-remarks-read">{form.remarks || '—'}</p>
                ) : (
                  <Input.TextArea
                    rows={5}
                    value={form.remarks}
                    placeholder={REMARKS_PLACEHOLDER}
                    onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
                    className="quotation-basic-remarks-input placeholder:text-gray-400"
                  />
                )}
              </BasicField>
            </FieldPermission>
          </div>
        </div>
      </div>

      <div className="mb-4 flex justify-between items-center">
        <h2 className="section-title mb-0">报价明细</h2>
        {!readOnly && (
          <Button type="dashed" icon={<PlusOutlined />} onClick={addItem}>添加明细行</Button>
        )}
      </div>

      {(form.items || []).map((item, index) => (
        <ItemEditor
          key={index}
          item={item}
          index={index}
          exchangeRate={form.exchange_rate}
          currency={form.currency}
          profitMargin={form.profit_margin}
          fabricOptions={fabricOptions}
          accessoryOptions={accessoryOptions}
          defaultWastage={agentDefaultWastage}
          optionsReady={optionsReady}
          onChange={(updated) => updateItem(index, updated)}
          onRemove={() => removeItem(index)}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}
