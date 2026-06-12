import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Form, Input, InputNumber, Button, message, Modal, Spin,
} from 'antd';
import { SaveOutlined, HistoryOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import PageHeader from '@/components/PageHeader';
import StyleImageUpload from '@/components/StyleImageUpload';
import StyleHistoryDrawer from '@/components/scheduling/StyleHistoryDrawer';
import { AutoFitInput, AutoFitInputNumber, AutoFitSelect, AutoFitDatePicker } from '@/components/AutoFitControl';
import { getStyle, createStyle, updateStyle } from '@/api/styles';
import { getBrands } from '@/api';
import type { Brand } from '@/types';
import type { StyleRecord } from '@/types/style';
import { CLOSING_MONTH_OPTIONS } from '@/types/style';
import { enrichStyleClient, formatMoney } from '@/utils/styleCalculations';

type BrandLinkedAgent = NonNullable<Brand['agents']>[number];

function StyleImageFormField({
  value,
  onChange,
}: {
  value?: string;
  onChange?: (path?: string) => void;
}) {
  return <StyleImageUpload value={value} onChange={onChange ?? (() => {})} />;
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="quotation-basic-section">
      <h3 className="quotation-basic-section-title">{title}</h3>
      {children}
    </div>
  );
}

const emptyForm = (): Partial<StyleRecord> => ({
  is_outsourced: false,
});

const FORM_DATE_FIELDS = [
  'required_shipping_date',
  'first_bed_time',
  'online_time',
  'offline_time',
] as const;

function serializeFormValues(values: Record<string, unknown>): string {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    if ((FORM_DATE_FIELDS as readonly string[]).includes(key) && value && dayjs.isDayjs(value)) {
      normalized[key] = (value as dayjs.Dayjs).format('YYYY-MM-DD');
    } else {
      normalized[key] = value;
    }
  }
  return JSON.stringify(normalized);
}

export default function StyleForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const schedulingListPath = (location.state as { schedulingTab?: string } | null)?.schedulingTab === 'early_warning'
    ? '/scheduling?tab=early_warning'
    : '/scheduling';
  const isNew = !id || id === 'new';
  const [form] = Form.useForm<StyleRecord>();
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [styleLabel, setStyleLabel] = useState<string>();
  const baselineRef = useRef('');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandAgents, setBrandAgents] = useState<BrandLinkedAgent[]>([]);

  const selectedBrand = Form.useWatch('brand', form);
  const requiredShippingDate = Form.useWatch('required_shipping_date', form);

  const quantity = Form.useWatch('quantity', form);
  const processingUnitPrice = Form.useWatch('processing_unit_price', form);
  const salesPrice = Form.useWatch('sales_price', form);

  const computed = useMemo(() => {
    const row = enrichStyleClient({
      quantity,
      processing_unit_price: processingUnitPrice,
      sales_price: salesPrice,
    } as StyleRecord);
    return {
      processingOutput: row.processing_output_value,
      salesOutput: row.sales_output_value,
    };
  }, [quantity, processingUnitPrice, salesPrice]);

  const brandOptions = useMemo(
    () => brands.map((b) => ({ value: b.name, label: b.name })),
    [brands],
  );

  const agentOptions = useMemo(
    () => brandAgents.map((a) => ({ value: a.name, label: a.name })),
    [brandAgents],
  );

  const closingMonthOptions = useMemo(
    () => CLOSING_MONTH_OPTIONS.map((m) => ({ value: m, label: m })),
    [],
  );

  useEffect(() => {
    getBrands()
      .then((res) => setBrands(res.data || []))
      .catch((err) => message.error(String(err)));
  }, []);

  useEffect(() => {
    if (!brands.length) return;
    const brand = selectedBrand ? brands.find((b) => b.name === selectedBrand) : undefined;
    const linked = brand?.agents || [];
    setBrandAgents(linked);

    if (!selectedBrand) {
      const current = form.getFieldValue('salesperson') as string | undefined;
      if (current) form.setFieldValue('salesperson', undefined);
      return;
    }
    if (!brand) return;

    const currentSalesperson = form.getFieldValue('salesperson') as string | undefined;
    if (currentSalesperson && !linked.some((a) => a.name === currentSalesperson)) {
      form.setFieldValue('salesperson', linked.length === 1 ? linked[0].name : undefined);
    } else if (!currentSalesperson && linked.length === 1) {
      form.setFieldValue('salesperson', linked[0].name);
    }
  }, [brands, selectedBrand]);

  useEffect(() => {
    if (!isNew || !requiredShippingDate) return;
    form.setFieldValue('closing_month', dayjs(requiredShippingDate).format('YYYY-MM'));
  }, [isNew, requiredShippingDate, form]);

  const syncBaseline = useCallback(() => {
    baselineRef.current = serializeFormValues(form.getFieldsValue(true));
  }, [form]);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    getStyle(Number(id))
      .then((res) => {
        const data = enrichStyleClient(res.data);
        setStyleLabel(data.style_number);
        form.setFieldsValue({
          ...data,
          first_bed_time: data.first_bed_time ? dayjs(data.first_bed_time) : undefined,
          online_time: data.online_time ? dayjs(data.online_time) : undefined,
          offline_time: data.offline_time ? dayjs(data.offline_time) : undefined,
          required_shipping_date: data.required_shipping_date ? dayjs(data.required_shipping_date) : undefined,
        } as unknown as StyleRecord);
        window.setTimeout(syncBaseline, 0);
      })
      .catch((err) => message.error(String(err)))
      .finally(() => setLoading(false));
  }, [id, isNew, form, syncBaseline]);

  useEffect(() => {
    if (loading || !isNew) return;
    const timer = window.setTimeout(syncBaseline, 0);
    return () => window.clearTimeout(timer);
  }, [loading, isNew, syncBaseline]);

  const formatDateField = (v: unknown) => (v ? dayjs(v as string).format('YYYY-MM-DD') : null);

  const isDirty = useCallback(() => {
    return serializeFormValues(form.getFieldsValue(true)) !== baselineRef.current;
  }, [form]);

  const saveForm = async (options?: { afterCreate?: 'detail' | 'list' }): Promise<boolean> => {
    try {
      const values = await form.validateFields();
      const payload: Record<string, unknown> = {
        ...values,
        required_shipping_date: formatDateField(values.required_shipping_date),
      };

      setSaving(true);
      if (isNew) {
        const res = await createStyle(payload);
        message.success('款式预警已创建');
        if (options?.afterCreate === 'list') {
          navigate(schedulingListPath);
        } else {
          navigate(`/scheduling/styles/${res.data.id}`, { replace: true, state: location.state });
        }
      } else {
        await updateStyle(Number(id), payload);
        message.success('保存成功');
        setStyleLabel(values.style_number);
        syncBaseline();
      }
      return true;
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return false;
      message.error(String(err));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    void saveForm();
  };

  const handleBack = () => {
    if (!isDirty()) {
      navigate(schedulingListPath);
      return;
    }
    setLeaveModalOpen(true);
  };

  const handleDiscardAndLeave = () => {
    setLeaveModalOpen(false);
    navigate(schedulingListPath);
  };

  const handleSaveAndLeave = async () => {
    const ok = await saveForm({ afterCreate: 'list' });
    if (ok) {
      setLeaveModalOpen(false);
      if (!isNew) navigate(schedulingListPath);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-96"><Spin size="large" /></div>;
  }

  return (
    <div className="page-container">
      <PageHeader
        title={isNew ? '新建款式预警' : '款式详情'}
        subtitle={styleLabel}
        onBack={handleBack}
        extra={(
          <>
            {!isNew && (
              <Button icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)}>
                变更历史
              </Button>
            )}
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
              保存
            </Button>
          </>
        )}
      />

      <Form
        form={form}
        layout="vertical"
        initialValues={emptyForm()}
        className="space-y-4"
      >
        <div className="card-panel quotation-basic-panel">
          <FormSection title="基本信息">
            <div className="style-form-basic-layout">
              <Form.Item
                name="style_number"
                label="款号"
                className="style-form-grid-field"
                rules={[{ required: true, message: '请输入款号' }]}
              >
                <AutoFitInput placeholder="款号" />
              </Form.Item>
              <Form.Item name="brand" label="品牌" className="style-form-grid-field">
                <AutoFitSelect
                  showSearch
                  allowClear
                  placeholder="选择品牌"
                  options={brandOptions}
                  filterOption={(input, option) =>
                    String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
              <Form.Item name="quantity" label="数量" className="style-form-grid-field">
                <AutoFitInputNumber min={0} placeholder="数量" />
              </Form.Item>
              <Form.Item name="style_name" label="款式名称" className="style-form-grid-field">
                <AutoFitInput placeholder="款式名称" />
              </Form.Item>
              <Form.Item name="salesperson" label="业务员" className="style-form-grid-field">
                <AutoFitSelect
                  allowClear
                  placeholder={selectedBrand ? '选择业务员' : '请先选择品牌'}
                  disabled={!selectedBrand || brandAgents.length === 0}
                  options={agentOptions}
                />
              </Form.Item>
              <Form.Item name="po_number" label="PO号" className="style-form-grid-field">
                <AutoFitInput placeholder="PO号" />
              </Form.Item>
              <Form.Item name="required_shipping_date" label="要求出货日" className="style-form-grid-field">
                <AutoFitDatePicker placeholder="要求出货日" />
              </Form.Item>
              <Form.Item name="closing_month" label="关账月份" className="style-form-grid-field">
                <AutoFitSelect
                  allowClear
                  placeholder="选择月份"
                  options={closingMonthOptions}
                />
              </Form.Item>
              <Form.Item name="style_image" label="款式图" className="style-form-grid-image style-form-image-item">
                <StyleImageFormField />
              </Form.Item>
              <Form.Item name="remarks" label="备注" className="style-form-remarks-field style-form-grid-field">
                <Input.TextArea
                  placeholder="备注信息"
                  autoSize={{ minRows: 1, maxRows: 4 }}
                />
              </Form.Item>
            </div>
          </FormSection>

          <FormSection title="物料跟进">
            <div className="style-form-material-rows">
              <div className="style-form-basic-row">
                <Form.Item name="fabric_readiness" label="面料进度" className="style-form-material-readiness-field style-form-material-fabric-readiness">
                  <Input.TextArea placeholder="面料进度" autoSize={{ minRows: 1, maxRows: 8 }} />
                </Form.Item>
                <Form.Item name="accessories_readiness" label="辅料进度" className="style-form-material-readiness-field style-form-material-accessories-readiness">
                  <Input.TextArea placeholder="辅料进度" autoSize={{ minRows: 1, maxRows: 8 }} />
                </Form.Item>
              </div>
              <div className="style-form-basic-row">
                <Form.Item name="fabric_structure" label="面料结构" className="style-form-flex-field">
                  <AutoFitInput placeholder="面料结构" />
                </Form.Item>
                <Form.Item name="sample_progress" label="样衣进度" className="style-form-flex-field">
                  <AutoFitInput placeholder="样衣进度" />
                </Form.Item>
                <Form.Item name="printing_embroidery" label="印绣花" className="style-form-flex-field">
                  <AutoFitInput placeholder="印绣花" />
                </Form.Item>
                <Form.Item name="order_follower" label="跟单员" className="style-form-flex-field">
                  <AutoFitInput placeholder="跟单员" />
                </Form.Item>
              </div>
            </div>
          </FormSection>

          <FormSection title="价格信息">
            <div className="quotation-basic-grid quotation-basic-grid-4">
              <Form.Item name="processing_unit_price" label="加工单价">
                <InputNumber className="w-full" min={0} step={0.01} precision={2} />
              </Form.Item>
              <Form.Item label="加工产值">
                <div className="quotation-basic-value">{formatMoney(computed.processingOutput)}</div>
              </Form.Item>
              <Form.Item name="sales_price" label="销售单价">
                <InputNumber className="w-full" min={0} step={0.01} precision={2} />
              </Form.Item>
              <Form.Item label="销售产值">
                <div className="quotation-basic-value">{formatMoney(computed.salesOutput)}</div>
              </Form.Item>
            </div>
          </FormSection>
        </div>
      </Form>

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

      {!isNew && (
        <StyleHistoryDrawer
          open={historyOpen}
          styleId={Number(id)}
          styleLabel={styleLabel}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  );
}
