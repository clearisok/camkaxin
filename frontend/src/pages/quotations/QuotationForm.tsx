import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Form, Select, DatePicker, InputNumber, Input, Button, Tag, message, Spin, Space, Radio,
} from 'antd';
import { SaveOutlined, ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getQuotation, createQuotation, updateQuotation,
  getBrands, getFabrics, getAccessories, getSettings,
  getBrandDefaultAccessories, trackBrandUsage,
} from '@/api';
import type { Quotation, QuotationItem, Brand, Fabric, Accessory } from '@/types';
import { createEmptyItem } from '@/types';
import { calcValidUntil } from '@/utils/calculation';
import { normalizeQuotationFromApi } from '@/utils/normalize';
import ItemEditor from '@/components/ItemEditor';
import { FieldPermission } from '@/components/FieldPermission';

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

  const [form, setForm] = useState<Quotation>({
    currency: 'RMB',
    exchange_rate: 6.8,
    profit_margin: 5,
    quote_date: dayjs().format('YYYY-MM-DD'),
    valid_until: calcValidUntil(dayjs()).format('YYYY-MM-DD'),
    status: 'draft',
    items: [createEmptyItem()],
  });

  useEffect(() => {
    Promise.all([getBrands(), getFabrics(), getAccessories(), getSettings()])
      .then(([b, f, a, s]) => {
        setBrands(b.data || []);
        setFabrics(f.data || []);
        setAccessories(a.data || []);
        const rate = parseFloat(s.data?.usd_to_rmb_rate || '6.8');
        setExchangeRate(rate);
        if (isNew) {
          setForm((prev) => ({ ...prev, exchange_rate: rate }));
        }
      }).catch(() => {});

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

  const handleBrandChange = async (brandId: number) => {
    const brand = brands.find((b) => b.id === brandId);
    setForm((prev) => ({
      ...prev,
      brand_id: brandId,
      agent_name: brand?.agent_name_ref || '',
    }));

    try {
      await trackBrandUsage(brandId);
      const res = await getBrandDefaultAccessories(brandId);
      const defaultAccs = res.data || [];
      if (defaultAccs.length > 0 && form.items?.length) {
        const items = [...form.items];
        items[0] = {
          ...items[0],
          accessories: defaultAccs.map((a: Accessory) => ({
            name: a.name,
            consumption: a.consumption ?? 1,
            wastage: a.wastage ?? 5,
            unit_price: a.unit_price ?? 0,
          })),
        };
        setForm((prev) => ({ ...prev, items }));
      }
    } catch { /* ignore */ }
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

    setSaving(true);
    try {
      const payload = {
        ...form,
        quote_date: form.quote_date,
        valid_until: form.valid_until,
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
      <div className="flex justify-between items-center mb-6">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/quotations')}>返回</Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {isNew ? '新建报价单' : readOnly ? '查看报价单' : '编辑报价单'}
            </h1>
            {form.quotation_no && <span className="text-gray-500 text-sm">{form.quotation_no}</span>}
          </div>
        </Space>
        {!readOnly && (
          <Button type="primary" size="large" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            保存
          </Button>
        )}
      </div>

      <div className="card-panel mb-6">
        <h2 className="section-title">基本信息</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <FieldPermission fieldCode="quotation.brand_id">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">品牌 *</label>
              {readOnly ? <span>{form.brand_name}</span> : (
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
            </div>
          </FieldPermission>

          <FieldPermission fieldCode="quotation.agent_name">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">业务员</label>
              <Tag color="blue" className="text-sm px-3 py-1">{form.agent_name || '选择品牌后自动填入'}</Tag>
            </div>
          </FieldPermission>

          <FieldPermission fieldCode="quotation.quote_date">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">报价日期</label>
              {readOnly ? <span>{form.quote_date}</span> : (
                <DatePicker
                  className="w-full"
                  value={form.quote_date ? dayjs(form.quote_date) : dayjs()}
                  onChange={(d) => {
                    if (d) {
                      setForm((prev) => ({
                        ...prev,
                        quote_date: d.format('YYYY-MM-DD'),
                        valid_until: calcValidUntil(d).format('YYYY-MM-DD'),
                      }));
                    }
                  }}
                />
              )}
            </div>
          </FieldPermission>

          <FieldPermission fieldCode="quotation.valid_until">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">有效期至</label>
              {readOnly ? <span>{form.valid_until}</span> : (
                <DatePicker
                  className="w-full"
                  value={form.valid_until ? dayjs(form.valid_until) : undefined}
                  onChange={(d) => d && setForm((prev) => ({ ...prev, valid_until: d.format('YYYY-MM-DD') }))}
                />
              )}
            </div>
          </FieldPermission>

          <FieldPermission fieldCode="quotation.currency">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">报价币种</label>
              {readOnly ? <span>{form.currency}</span> : (
                <Radio.Group
                  value={form.currency}
                  onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}
                  options={[{ value: 'RMB', label: 'RMB' }, { value: 'USD', label: 'USD' }]}
                />
              )}
            </div>
          </FieldPermission>

          <FieldPermission fieldCode="quotation.exchange_rate">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">汇率 (USD→RMB)</label>
              {readOnly ? <span>{form.exchange_rate}</span> : (
                <InputNumber
                  className="w-full"
                  value={form.exchange_rate}
                  onChange={(v) => setForm((prev) => ({ ...prev, exchange_rate: v || exchangeRate }))}
                  min={0}
                  step={0.0001}
                  precision={4}
                />
              )}
            </div>
          </FieldPermission>

          <FieldPermission fieldCode="quotation.profit_margin">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">利润率 (%)</label>
              {readOnly ? <span>{form.profit_margin}%</span> : (
                <InputNumber
                  className="w-full"
                  value={form.profit_margin}
                  onChange={(v) => setForm((prev) => ({ ...prev, profit_margin: v ?? 5 }))}
                  min={0}
                  max={100}
                />
              )}
            </div>
          </FieldPermission>

          <FieldPermission fieldCode="quotation.status">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">状态</label>
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
            </div>
          </FieldPermission>
        </div>

        <div className="mt-4">
          <FieldPermission fieldCode="quotation.remarks">
            <label className="text-sm text-gray-500 mb-1 block">备注</label>
            {readOnly ? <p className="text-gray-700">{form.remarks}</p> : (
              <Input.TextArea rows={2} value={form.remarks} onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))} />
            )}
          </FieldPermission>
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
          onChange={(updated) => updateItem(index, updated)}
          onRemove={() => removeItem(index)}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}
