import { useEffect, useState, useMemo, useCallback, useRef, type ReactNode } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Select, DatePicker, InputNumber, Input, Button, Tag, message, Spin, Radio, Modal,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
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
import {
  applyProductCodeToItems,
  deriveQuotationProductCode,
} from '@/utils/quotationProductCode';
import {
  buildVersionGroups,
  cloneItemFromSource,
  ensureVersionGroupKeys,
  newVersionGroupKey,
  stripClientItemFields,
  type VersionRowDraft,
} from '@/utils/quotationVersionGroups';
import ItemEditor from '@/components/ItemEditor';
import StyleImageUpload from '@/components/StyleImageUpload';
import { FieldPermission } from '@/components/FieldPermission';
import { useRegisterHeaderActions } from '@/contexts/HeaderActionsContext';

const REMARKS_PLACEHOLDER = '着重填写：面料特性/部位情况(如口袋/门襟/裤耳等)/工艺';

function BasicField({
  label,
  required,
  children,
  className = '',
  compact = false,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={`quotation-basic-field${compact ? ' quotation-basic-field--compact' : ''} ${className}`}>
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

function serializeQuotationForm(form: Quotation): string {
  return JSON.stringify(form);
}

export default function QuotationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
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
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const baselineRef = useRef('');
  const baselineReadyRef = useRef(false);

  const [form, setForm] = useState<Quotation>({
    currency: 'RMB',
    exchange_rate: 6.8,
    profit_margin: 5,
    quote_date: beijingNow().format('YYYY-MM-DD'),
    status: 'draft',
    product_code: '',
    items: [createEmptyItem()],
  });

  const isDirty = useCallback(() => {
    if (!baselineReadyRef.current) return false;
    return serializeQuotationForm(form) !== baselineRef.current;
  }, [form]);

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
          setForm((prev) => {
            const next = { ...prev, exchange_rate: rate };
            if (!baselineReadyRef.current) {
              baselineRef.current = serializeQuotationForm(next);
              baselineReadyRef.current = true;
            }
            return next;
          });
        }
      }).catch((loadErr) => {
        message.error((loadErr as Error).message || '加载选项失败');
      })
      .finally(() => setOptionsReady(true));

    if (id) {
      setLoading(true);
      baselineReadyRef.current = false;
      getQuotation(parseInt(id, 10))
        .then((data) => {
          const normalized = normalizeQuotationFromApi(data as Record<string, unknown>);
          const items = ensureVersionGroupKeys(
            normalized.items?.length ? (normalized.items as QuotationItem[]) : [createEmptyItem()],
          );
          const nextForm: Quotation = {
            ...(normalized as Quotation),
            product_code: deriveQuotationProductCode(items),
            items,
          };
          setForm(nextForm);
          baselineRef.current = serializeQuotationForm(nextForm);
          baselineReadyRef.current = true;
        })
        .catch((err) => message.error(String(err)))
        .finally(() => setLoading(false));
    }
  }, [id, isNew]);

  useEffect(() => {
    if (!isNew || loading || !optionsReady || baselineReadyRef.current) return;
    const timer = window.setTimeout(() => {
      baselineRef.current = serializeQuotationForm(form);
      baselineReadyRef.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isNew, loading, optionsReady, form]);

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

  const versionGroups = useMemo(
    () => buildVersionGroups(form.items || []),
    [form.items],
  );

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

  const addVersionItems = (sourceIndex: number, rows: VersionRowDraft[]) => {
    if (!rows.length) return;
    setForm((prev) => {
      const items = [...(prev.items || [])];
      const source = items[sourceIndex];
      if (!source) return prev;

      const groupKey = source.version_group_key || newVersionGroupKey();

      items[sourceIndex] = {
        ...source,
        version_group_key: groupKey,
        version_label: rows[0].version_label,
        showVersionLabel: true,
        quantity: rows[0].quantity ?? source.quantity ?? 0,
        labor_cost_usd: rows[0].labor_cost_usd ?? source.labor_cost_usd ?? 0,
      };

      let insertAt = sourceIndex + 1;
      for (let i = 1; i < rows.length; i += 1) {
        const row = rows[i];
        items.splice(insertAt, 0, cloneItemFromSource(source, {
          version_group_key: groupKey,
          version_label: row.version_label,
          showVersionLabel: true,
          quantity: row.quantity ?? 0,
          labor_cost_usd: row.labor_cost_usd ?? 0,
        }));
        insertAt += 1;
      }

      return { ...prev, items };
    });
  };

  const removeVersionItem = (index: number) => {
    const items = form.items || [];
    if (items.length <= 1) {
      message.warning('至少保留一条明细');
      return;
    }
    setForm((prev) => ({
      ...prev,
      items: prev.items?.filter((_, i) => i !== index),
    }));
  };

  const removeItem = (index: number) => {
    removeVersionItem(index);
  };

  const handleSave = async (): Promise<boolean> => {
    if (!form.brand_id) {
      message.warning('请选择品牌');
      return false;
    }
    if (brandAgents.length > 0 && !form.agent_name) {
      message.warning('请选择业务员');
      return false;
    }

    setSaving(true);
    try {
      const items = applyProductCodeToItems(form.items || [], form.product_code || '')
        .map(stripClientItemFields);
      const payload = {
        ...form,
        items,
        exchange_rate: roundRate(form.exchange_rate, exchangeRate),
        quote_date: form.quote_date,
        fabric_delivery_date: form.fabric_delivery_date,
        garment_delivery_date: form.garment_delivery_date,
      };

      if (isNew) {
        const res = await createQuotation(payload);
        message.success('创建成功');
        baselineReadyRef.current = false;
        navigate(`/quotations/${res.id}/edit`);
      } else {
        await updateQuotation(parseInt(id!, 10), payload);
        message.success('保存成功');
        const nextForm = { ...form, items };
        setForm(nextForm);
        baselineRef.current = serializeQuotationForm(nextForm);
        baselineReadyRef.current = true;
      }
      return true;
    } catch (err) {
      message.error(String(err));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  const handleSaveStable = useCallback(() => {
    void handleSaveRef.current();
  }, []);

  const handleBack = useCallback(() => {
    if (!isDirty()) {
      navigate('/quotations');
      return;
    }
    setLeaveModalOpen(true);
  }, [isDirty, navigate]);

  const handleDiscardAndLeave = () => {
    setLeaveModalOpen(false);
    navigate('/quotations');
  };

  const handleSaveAndLeave = async () => {
    const ok = await handleSaveRef.current();
    if (ok) {
      setLeaveModalOpen(false);
      if (!isNew) navigate('/quotations');
    }
  };

  useRegisterHeaderActions({
    back: !readOnly,
    onBack: handleBack,
    save: !readOnly,
    onSave: handleSaveStable,
    saving,
  });

  if (loading) {
    return <div className="flex justify-center items-center h-96"><Spin size="large" /></div>;
  }

  return (
    <div className="page-container">
      <div className="card-panel mb-6 quotation-basic-panel">
        <h2 className="section-title">基本信息</h2>

        <div className="quotation-basic-section">
          <div className="quotation-basic-layout">
            <div className="quotation-basic-image-col">
              <FieldPermission fieldCode="quotation.style_image">
                <BasicField label="款式图" compact>
                  <StyleImageUpload
                    value={form.style_image}
                    onChange={(path) => setForm((prev) => ({ ...prev, style_image: path }))}
                    readOnly={readOnly}
                    compact
                  />
                </BasicField>
              </FieldPermission>
            </div>

            <div className="quotation-basic-fields-col">
              <div className="quotation-basic-grid quotation-basic-grid-7">
                <FieldPermission fieldCode="quotation.product_codes">
                  <BasicField label="款号" compact>
                    {readOnly ? (
                      <span className="quotation-basic-value">{form.product_code || form.product_codes || '—'}</span>
                    ) : (
                      <Input
                        size="small"
                        value={form.product_code}
                        placeholder="款号"
                        onChange={(e) => setForm((prev) => ({ ...prev, product_code: e.target.value }))}
                      />
                    )}
                  </BasicField>
                </FieldPermission>

                <FieldPermission fieldCode="quotation.brand_id">
                  <BasicField label="品牌" required compact>
                    {readOnly ? <span className="quotation-basic-value">{form.brand_name}</span> : (
                      <Select
                        size="small"
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
                  <BasicField label="业务员" required compact>
                    {readOnly ? (
                      <span className="quotation-basic-value">{form.agent_name || '—'}</span>
                    ) : (
                      <Select
                        size="small"
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

                <FieldPermission fieldCode="quotation.fabric_delivery_date">
                  <BasicField label="面料交期" compact>
                    {readOnly ? <span className="quotation-basic-value">{form.fabric_delivery_date || '—'}</span> : (
                      <DatePicker
                        size="small"
                        className="w-full"
                        placeholder="选择日期"
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
                  <BasicField label="成衣交期" compact>
                    {readOnly ? <span className="quotation-basic-value">{form.garment_delivery_date || '—'}</span> : (
                      <DatePicker
                        size="small"
                        className="w-full"
                        placeholder="选择日期"
                        value={form.garment_delivery_date ? dayjs(form.garment_delivery_date) : undefined}
                        onChange={(d) => setForm((prev) => ({
                          ...prev,
                          garment_delivery_date: d ? d.format('YYYY-MM-DD') : undefined,
                        }))}
                      />
                    )}
                  </BasicField>
                </FieldPermission>

                <FieldPermission fieldCode="quotation.quote_date">
                  <BasicField label="报价日期" compact>
                    {readOnly ? <span className="quotation-basic-value">{form.quote_date}</span> : (
                      <DatePicker
                        size="small"
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
                  <BasicField label="状态" compact>
                    {readOnly ? <Tag>{form.status}</Tag> : (
                      <Select
                        size="small"
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

              <div className="quotation-basic-grid quotation-basic-grid-7">
                <FieldPermission fieldCode="quotation.target_labor_price">
                  <BasicField label="目标工价" compact>
                    {readOnly ? <span className="quotation-basic-value">{formatOptionalPrice(form.target_labor_price)}</span> : (
                      <InputNumber
                        size="small"
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

                <FieldPermission fieldCode="quotation.confirmed_labor_price">
                  <BasicField label="确认工价" compact>
                    {readOnly ? <span className="quotation-basic-value">{formatOptionalPrice(form.confirmed_labor_price)}</span> : (
                      <InputNumber
                        size="small"
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

                <FieldPermission fieldCode="quotation.target_garment_price">
                  <BasicField label="目标成衣价格" compact>
                    {readOnly ? <span className="quotation-basic-value">{formatOptionalPrice(form.target_garment_price)}</span> : (
                      <InputNumber
                        size="small"
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

                <FieldPermission fieldCode="quotation.confirmed_garment_price">
                  <BasicField label="确认成衣价格" compact>
                    {readOnly ? <span className="quotation-basic-value">{formatOptionalPrice(form.confirmed_garment_price)}</span> : (
                      <InputNumber
                        size="small"
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

                <FieldPermission fieldCode="quotation.currency">
                  <BasicField label="报价币种" compact>
                    {readOnly ? <span className="quotation-basic-value">{form.currency}</span> : (
                      <Radio.Group
                        size="small"
                        value={form.currency}
                        onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}
                        options={[{ value: 'RMB', label: 'RMB' }, { value: 'USD', label: 'USD' }]}
                      />
                    )}
                  </BasicField>
                </FieldPermission>

                <FieldPermission fieldCode="quotation.exchange_rate">
                  <BasicField label="汇率" compact>
                    {readOnly ? <span className="quotation-basic-value">{roundRate(form.exchange_rate).toFixed(2)}</span> : (
                      <InputNumber
                        size="small"
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
                  <BasicField label="利润率 (%)" compact>
                    {readOnly ? <span className="quotation-basic-value">{form.profit_margin}%</span> : (
                      <InputNumber
                        size="small"
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

              <div className="quotation-basic-remarks-row">
                <FieldPermission fieldCode="quotation.remarks">
                  <BasicField label="备注" compact className="quotation-basic-remarks-field">
                    {readOnly ? (
                      <p className="quotation-basic-value quotation-basic-remarks-read">{form.remarks || '—'}</p>
                    ) : (
                      <Input.TextArea
                        size="small"
                        rows={1}
                        autoSize={{ minRows: 1, maxRows: 3 }}
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
        </div>
      </div>

      <div className="mb-4 flex justify-between items-center">
        <h2 className="section-title mb-0">报价明细</h2>
        {!readOnly && (
          <Button type="dashed" icon={<PlusOutlined />} onClick={addItem}>添加明细行</Button>
        )}
      </div>

      {(versionGroups).map((group) => (
        <ItemEditor
          key={group.groupKey}
          groupKey={group.groupKey}
          itemIndices={group.indices}
          items={form.items || []}
          productCode={form.product_code}
          exchangeRate={form.exchange_rate}
          currency={form.currency}
          profitMargin={form.profit_margin}
          fabricOptions={fabricOptions}
          accessoryOptions={accessoryOptions}
          defaultWastage={agentDefaultWastage}
          optionsReady={optionsReady}
          onUpdateItem={updateItem}
          onRemoveVersion={removeVersionItem}
          onAddVersions={addVersionItems}
          readOnly={readOnly}
        />
      ))}

      <Modal
        title="未保存的更改"
        open={leaveModalOpen}
        onCancel={() => setLeaveModalOpen(false)}
        footer={[
          <Button key="stay" onClick={() => setLeaveModalOpen(false)}>
            继续编辑
          </Button>,
          <Button key="discard" onClick={handleDiscardAndLeave}>
            不保存
          </Button>,
          <Button key="save" type="primary" loading={saving} onClick={() => void handleSaveAndLeave()}>
            保存并返回
          </Button>,
        ]}
      >
        当前有未保存的修改，是否保存后再离开？
      </Modal>
    </div>
  );
}
