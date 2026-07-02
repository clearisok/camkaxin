import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Form, Input, InputNumber, Button, message, Modal, Spin, Select, Collapse,
} from 'antd';
import dayjs from 'dayjs';
import StyleImageUpload from '@/components/StyleImageUpload';
import StyleHistoryDrawer from '@/components/scheduling/StyleHistoryDrawer';
import { AutoFitInput, AutoFitInputNumber, AutoFitSelect, AutoFitDatePicker } from '@/components/AutoFitControl';
import { DetailHero, KpiGrid, SectionCard, StatusPill } from '@/components/ui';
import type { KpiGridItem } from '@/components/ui';
import type { StatusTone } from '@/design/tokens';
import DetailPageLayout from '@/layouts/templates/DetailPageLayout';
import { getStyle, createStyle, updateStyle } from '@/api/styles';
import { getBrands } from '@/api';
import type { Brand } from '@/types';
import type { ClosingOrderStatus, StyleRecord } from '@/types/style';
import { CLOSING_MONTH_OPTIONS } from '@/types/style';
import { enrichStyleClient, formatMoney } from '@/utils/styleCalculations';
import { formatDateTimeBeijing } from '@/utils/beijingTime';
import { formatOutputValueNumber } from '@/utils/earlyWarningExport';
import {
  CLOSING_ORDER_STATUS_LABELS,
  getClosingOrderStatus,
} from '@/utils/closingMonthView';
import { inferZone, type SchedulingZone } from '@/utils/schedulingZone';
import { useRegisterHeaderActions } from '@/contexts/HeaderActionsContext';
import styles from './StyleForm.module.css';

type BrandLinkedAgent = NonNullable<Brand['agents']>[number];

const ZONE_LABELS: Record<SchedulingZone, string> = {
  wait: '待排单',
  group: '生产组',
  outsource: '外发',
  offline: '已下线',
};

const ZONE_STATUS: Record<SchedulingZone, StatusTone> = {
  wait: 'warning',
  group: 'primary',
  outsource: 'default',
  offline: 'success',
};

const CLOSING_STATUS_TONE: Record<ClosingOrderStatus, StatusTone> = {
  online: 'success',
  offline: 'success',
  outsourced: 'primary',
  not_online: 'default',
};

const DETAIL_EDITABLE_FIELDS = [
  'style_number',
  'style_name',
  'brand',
  'po_number',
  'salesperson',
  'quantity',
  'order_type',
  'closing_month',
  'required_shipping_date',
  'processing_unit_price',
  'sales_price',
  'fabric_structure',
  'order_follower',
  'overseas_merchandiser',
  'short_over_shipment',
  'style_image',
  'fabric_readiness',
  'accessories_readiness',
  'sample_progress',
  'remarks',
] as const;

function formatUnitPriceUsd(v?: number | null): string {
  if (v == null || Number.isNaN(v)) return '—';
  return `$${formatMoney(v)}`;
}

function formatUnitPriceCny(v?: number | null): string {
  if (v == null || Number.isNaN(v)) return '—';
  return `￥${formatMoney(v)}`;
}

function buildHeroKpiItems(
  watched: StyleRecord | undefined,
  formatDateField: (v: unknown) => string | null,
): KpiGridItem[] {
  const items: KpiGridItem[] = [
    {
      label: '数量',
      value: watched?.quantity != null ? watched.quantity.toLocaleString('zh-CN') : undefined,
    },
    { label: '关联月份', value: watched?.closing_month },
    {
      label: '出货日',
      value: watched?.required_shipping_date
        ? formatDateField(watched.required_shipping_date) ?? '—'
        : undefined,
    },
    { label: '加工单价', value: formatUnitPriceUsd(watched?.processing_unit_price) },
  ];

  if (watched?.order_type !== 'processing') {
    items.push({ label: '销售单价', value: formatUnitPriceCny(watched?.sales_price) });
  }

  items.push(
    { label: '订单类型', value: watched?.order_type === 'processing' ? '加工' : '经销' },
    { label: '业务员', value: watched?.salesperson },
    { label: '跟单员', value: watched?.order_follower },
    { label: '海外跟单', value: watched?.overseas_merchandiser },
    { label: '短溢装', value: watched?.short_over_shipment },
    { label: '面料结构', value: watched?.fabric_structure, itemWidth: 'wide' },
  );

  return items;
}

interface IdentityFieldsProps {
  fieldClass: string;
  brandOptions: { value: string; label: string }[];
  agentOptions: { value: string; label: string }[];
  closingMonthOptions: { value: string; label: string }[];
  selectedBrand?: string;
  brandAgents: BrandLinkedAgent[];
  variant: 'new' | 'detail';
}

function IdentityFields({
  fieldClass,
  brandOptions,
  agentOptions,
  closingMonthOptions,
  selectedBrand,
  brandAgents,
  variant,
}: IdentityFieldsProps) {
  const form = Form.useFormInstance<StyleRecord>();
  const orderType = Form.useWatch('order_type', form) ?? 'distribution';

  const fieldsGrid = (
    <div className={variant === 'detail' ? `${styles.grid} ${styles.gridFive}` : styles.grid}>
      <Form.Item
        name="style_number"
        label="款号"
        className={fieldClass}
        rules={[{ required: true, message: '请输入款号' }]}
      >
        <AutoFitInput placeholder="款号" />
      </Form.Item>
      <Form.Item name="style_name" label="款式名称" className={fieldClass}>
        <AutoFitInput placeholder="款式名称" />
      </Form.Item>
      <Form.Item name="brand" label="品牌" className={fieldClass}>
        <AutoFitSelect
          showSearch
          allowClear
          placeholder="品牌"
          options={brandOptions}
          filterOption={(input, option) =>
            String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
        />
      </Form.Item>
      <Form.Item name="po_number" label="PO号" className={fieldClass}>
        <AutoFitInput placeholder="PO号" />
      </Form.Item>
      <Form.Item name="quantity" label="数量" className={fieldClass}>
        <AutoFitInputNumber min={0} placeholder="数量" />
      </Form.Item>
      <Form.Item name="order_type" label="订单类型" className={fieldClass} initialValue="distribution">
        <AutoFitSelect
          options={[
            { value: 'distribution', label: '经销' },
            { value: 'processing', label: '加工' },
          ]}
        />
      </Form.Item>
      <Form.Item name="closing_month" label="关联月份" className={fieldClass}>
        <AutoFitSelect allowClear placeholder="关联月份" options={closingMonthOptions} />
      </Form.Item>
      <Form.Item name="required_shipping_date" label="要求出货日" className={fieldClass}>
        <AutoFitDatePicker placeholder="出货日" />
      </Form.Item>
      <Form.Item name="processing_unit_price" label="加工单价 ($)" className={fieldClass}>
        <InputNumber className="w-full" min={0} step={0.01} precision={2} />
      </Form.Item>
      {orderType !== 'processing' && (
        <Form.Item name="sales_price" label="销售单价 (￥)" className={fieldClass}>
          <InputNumber className="w-full" min={0} step={0.01} precision={2} />
        </Form.Item>
      )}
      <Form.Item name="fabric_structure" label="面料结构" className={fieldClass}>
        <AutoFitInput placeholder="面料结构" />
      </Form.Item>
      <Form.Item name="salesperson" label="业务员" className={fieldClass}>
        <AutoFitSelect
          allowClear
          placeholder={selectedBrand ? '业务员' : '先选品牌'}
          disabled={!selectedBrand || brandAgents.length === 0}
          options={agentOptions}
        />
      </Form.Item>
      <Form.Item name="order_follower" label="跟单员" className={fieldClass}>
        <AutoFitInput placeholder="跟单员" />
      </Form.Item>
      <Form.Item name="overseas_merchandiser" label="海外跟单" className={fieldClass}>
        <AutoFitInput placeholder="海外跟单" />
      </Form.Item>
      <Form.Item name="short_over_shipment" label="短溢装" className={fieldClass}>
        <AutoFitInput placeholder="短溢装" />
      </Form.Item>
      {variant === 'new' && (
        <Form.Item name="style_image" label="款式图" className={`${fieldClass} ${styles.imageField}`}>
          <StyleImageFormField />
        </Form.Item>
      )}
    </div>
  );

  if (variant === 'detail') {
    return (
      <div className={styles.basicEdit}>
        {fieldsGrid}
        <div className={styles.basicImage}>
          <Form.Item name="style_image" label="款式图" className={fieldClass}>
            <StyleImageFormField compact />
          </Form.Item>
        </div>
      </div>
    );
  }

  return fieldsGrid;
}

function StyleImageFormField({
  value,
  onChange,
  compact,
}: {
  value?: string;
  onChange?: (path?: string) => void;
  compact?: boolean;
}) {
  return <StyleImageUpload value={value} onChange={onChange ?? (() => {})} compact={compact} />;
}

function ReadOnlyMetric({
  label,
  value,
}: {
  label: string;
  value?: ReactNode;
}) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>{value ?? '—'}</span>
    </div>
  );
}

function StyleSchedulingReadOnlyPanel({
  data,
  summaryRow,
  summaryZone,
  loadedMeta,
  formatDateField,
}: {
  data: StyleRecord | undefined;
  summaryRow: StyleRecord;
  summaryZone: SchedulingZone;
  loadedMeta: LoadedMeta | null;
  formatDateField: (v: unknown) => string | null;
}) {
  const schedulingItems: KpiGridItem[] = [
    { label: '上线时间', value: formatDateField(data?.online_time) ?? '—' },
    { label: '下线时间', value: formatDateField(data?.offline_time) ?? '—' },
    { label: '所需天数', value: data?.required_days ?? '—' },
    {
      label: '假期天数',
      value: loadedMeta?.holiday_days ?? summaryRow.holiday_days ?? '—',
    },
    { label: '首床时间', value: formatDateField(data?.first_bed_time) ?? '—' },
    { label: '排入数量', value: data?.scheduled_output ?? '—' },
    { label: '日均产量', value: data?.avg_daily_output ?? '—' },
    { label: '产出比', value: summaryRow.output_ratio ?? '—' },
    { label: '排单区位', value: ZONE_LABELS[summaryZone] },
    { label: '日历天数', value: summaryRow.days ?? '—' },
    { label: '排入组别', value: data?.group_name ?? '—' },
    { label: '排单顺位', value: data?.sort_order ?? '—' },
    { label: '已排数量', value: loadedMeta?.allocated_quantity ?? '—' },
    { label: '未排数量', value: loadedMeta?.unscheduled_quantity ?? '—' },
    { label: '排单备注', value: data?.scheduling_remarks, itemWidth: 'full' },
  ];

  const outsourceItems: KpiGridItem[] = [
    { label: '是否外发', value: data?.is_outsourced ? '是' : '否' },
    { label: '外发工厂', value: data?.outsourced_factory },
    {
      label: '外发单价',
      value: data?.outsourced_price != null ? formatMoney(data.outsourced_price) : '—',
    },
  ];

  return (
    <>
      <SectionCard title="排产进度">
        <KpiGrid items={schedulingItems} />
      </SectionCard>
      <SectionCard title="外发">
        <KpiGrid items={outsourceItems} />
      </SectionCard>
    </>
  );
}

function resolveSchedulingListPath(state: unknown): string {
  const tab = (state as { schedulingTab?: string } | null)?.schedulingTab;
  if (tab === 'early_warning' || tab === 'scheduling' || tab === 'closing') {
    return `/scheduling?tab=${tab}`;
  }
  return '/scheduling?tab=early_warning';
}

function toFormYmd(value: unknown): string | undefined {
  if (!value) return undefined;
  if (dayjs.isDayjs(value)) return value.format('YYYY-MM-DD');
  const d = dayjs(value as string);
  return d.isValid() ? d.format('YYYY-MM-DD') : undefined;
}

function buildSummaryRow(watched: StyleRecord | undefined): StyleRecord {
  return enrichStyleClient({
    ...watched,
    online_time: toFormYmd(watched?.online_time),
    offline_time: toFormYmd(watched?.offline_time),
    required_shipping_date: toFormYmd(watched?.required_shipping_date),
    first_bed_time: toFormYmd(watched?.first_bed_time),
  } as StyleRecord);
}

const emptyForm = (): Partial<StyleRecord> => ({
  is_outsourced: false,
  order_type: 'distribution',
});

const FORM_DATE_FIELDS = [
  'required_shipping_date',
  'first_bed_time',
  'online_time',
  'offline_time',
] as const;

function serializeFormValues(
  values: Record<string, unknown>,
  fieldKeys?: readonly string[],
): string {
  const normalized: Record<string, unknown> = {};
  const keys = fieldKeys ?? Object.keys(values);
  for (const key of keys) {
    const value = values[key];
    if (value === undefined || value === null || value === '') continue;
    if ((FORM_DATE_FIELDS as readonly string[]).includes(key)) {
      const ymd = toFormYmd(value);
      if (ymd) normalized[key] = ymd;
      continue;
    }
    normalized[key] = value;
  }
  return JSON.stringify(normalized);
}

function pickFormValues(
  values: Record<string, unknown>,
  fieldKeys: readonly string[],
): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const key of fieldKeys) {
    if (key in values) picked[key] = values[key];
  }
  return picked;
}

interface LoadedMeta {
  id: number;
  created_at?: string;
  updated_at?: string;
  allocated_quantity?: number;
  unscheduled_quantity?: number;
  holiday_days?: number | null;
  parent_style_id?: number | null;
  cancelled_quantity?: number;
}

export default function StyleForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const schedulingListPath = resolveSchedulingListPath(location.state);
  const isNew = !id || id === 'new';
  const [form] = Form.useForm<StyleRecord>();
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [styleLabel, setStyleLabel] = useState<string>();
  const [loadedMeta, setLoadedMeta] = useState<LoadedMeta | null>(null);
  const [displayStyle, setDisplayStyle] = useState<StyleRecord | null>(null);
  const baselineRef = useRef('');
  const baselineReadyForIdRef = useRef<number | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandAgents, setBrandAgents] = useState<BrandLinkedAgent[]>([]);

  const watched = Form.useWatch([], form) as StyleRecord | undefined;
  const selectedBrand = watched?.brand;
  const requiredShippingDate = watched?.required_shipping_date;

  const heroStyle = useMemo((): StyleRecord | undefined => {
    if (isNew) return watched;
    if (!displayStyle) return watched;
    if (!watched) return displayStyle;
    return { ...displayStyle, ...watched };
  }, [isNew, displayStyle, watched]);

  const summaryRow = useMemo(() => buildSummaryRow(heroStyle), [heroStyle]);

  const summaryStatus = useMemo(() => {
    if (!heroStyle) return null;
    return getClosingOrderStatus(summaryRow);
  }, [heroStyle, summaryRow]);

  const summaryZone = useMemo(() => inferZone(summaryRow), [summaryRow]);

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

  const yesNoOptions = useMemo(
    () => [{ value: true, label: '是' }, { value: false, label: '否' }],
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
  }, [brands, selectedBrand, form]);

  useEffect(() => {
    if (!isNew || !requiredShippingDate) return;
    const d = dayjs.isDayjs(requiredShippingDate)
      ? requiredShippingDate
      : dayjs(requiredShippingDate as string);
    if (d.isValid()) {
      form.setFieldValue('closing_month', d.format('YYYY-MM'));
    }
  }, [isNew, requiredShippingDate, form]);

  const syncBaseline = useCallback(() => {
    const allValues = form.getFieldsValue(true) as Record<string, unknown>;
    const values = isNew
      ? allValues
      : pickFormValues(allValues, DETAIL_EDITABLE_FIELDS);
    baselineRef.current = serializeFormValues(values, isNew ? undefined : DETAIL_EDITABLE_FIELDS);
  }, [form, isNew]);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    getStyle(Number(id))
      .then((res) => {
        const data = enrichStyleClient(res.data);
        setStyleLabel(data.style_number);
        setDisplayStyle(data);
        setLoadedMeta({
          id: data.id,
          created_at: data.created_at,
          updated_at: data.updated_at,
          allocated_quantity: data.allocated_quantity,
          unscheduled_quantity: data.unscheduled_quantity,
          holiday_days: data.holiday_days,
          parent_style_id: data.parent_style_id,
          cancelled_quantity: data.cancelled_quantity,
        });
        form.setFieldsValue({
          ...data,
          first_bed_time: data.first_bed_time ? dayjs(data.first_bed_time) : undefined,
          online_time: data.online_time ? dayjs(data.online_time) : undefined,
          offline_time: data.offline_time ? dayjs(data.offline_time) : undefined,
          required_shipping_date: data.required_shipping_date ? dayjs(data.required_shipping_date) : undefined,
        } as unknown as StyleRecord);
      })
      .catch((err) => message.error(String(err)))
      .finally(() => setLoading(false));
  }, [id, isNew, form]);

  useEffect(() => {
    baselineReadyForIdRef.current = null;
  }, [id]);

  useEffect(() => {
    if (isNew || loading || !displayStyle) return;
    const styleId = Number(id);
    if (baselineReadyForIdRef.current === styleId) return;
    if (displayStyle.brand && !brands.length) return;

    const timer = window.setTimeout(() => {
      syncBaseline();
      baselineReadyForIdRef.current = styleId;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isNew, loading, displayStyle, brands, id, syncBaseline]);

  useEffect(() => {
    if (loading || !isNew) return;
    const timer = window.setTimeout(syncBaseline, 0);
    return () => window.clearTimeout(timer);
  }, [loading, isNew, syncBaseline]);

  const formatDateField = (v: unknown) => {
    if (!v) return null;
    return toFormYmd(v) ?? null;
  };

  const isDirty = useCallback(() => {
    const allValues = form.getFieldsValue(true) as Record<string, unknown>;
    const values = isNew
      ? allValues
      : pickFormValues(allValues, DETAIL_EDITABLE_FIELDS);
    const current = serializeFormValues(values, isNew ? undefined : DETAIL_EDITABLE_FIELDS);
    return current !== baselineRef.current;
  }, [form, isNew]);

  const saveForm = async (options?: { afterCreate?: 'detail' | 'list' }): Promise<boolean> => {
    try {
      const fieldNames = isNew ? undefined : [...DETAIL_EDITABLE_FIELDS];
      const values = fieldNames
        ? await form.validateFields(fieldNames)
        : await form.validateFields();
      const payload: Record<string, unknown> = { ...values };
      for (const key of FORM_DATE_FIELDS) {
        if (key in values) {
          payload[key] = formatDateField(values[key as keyof StyleRecord]);
        }
      }
      if (payload.order_type === 'processing') {
        payload.sales_price = null;
      }

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
        const res = await updateStyle(Number(id), payload);
        const data = enrichStyleClient(res.data);
        setStyleLabel(data.style_number);
        setDisplayStyle(data);
        setLoadedMeta({
          id: data.id,
          created_at: data.created_at,
          updated_at: data.updated_at,
          allocated_quantity: data.allocated_quantity,
          unscheduled_quantity: data.unscheduled_quantity,
          holiday_days: data.holiday_days,
          parent_style_id: data.parent_style_id,
          cancelled_quantity: data.cancelled_quantity,
        });
        syncBaseline();
        message.success('保存成功');
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

  const saveFormRef = useRef(saveForm);
  saveFormRef.current = saveForm;

  const handleSave = useCallback(() => {
    void saveFormRef.current();
  }, []);

  const handleBack = useCallback(() => {
    if (!isDirty()) {
      navigate(schedulingListPath);
      return;
    }
    setLeaveModalOpen(true);
  }, [isDirty, navigate, schedulingListPath]);

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

  const handleOpenHistory = useCallback(() => {
    setHistoryOpen(true);
  }, []);

  useRegisterHeaderActions({
    back: true,
    onBack: handleBack,
    history: !isNew,
    onHistory: handleOpenHistory,
    save: true,
    onSave: handleSave,
    saving,
  });

  if (loading) {
    return <div className="flex justify-center items-center h-96"><Spin size="large" /></div>;
  }

  const fieldClass = styles.field;

  const identityFieldsProps: IdentityFieldsProps = {
    fieldClass,
    brandOptions,
    agentOptions,
    closingMonthOptions,
    selectedBrand,
    brandAgents,
    variant: isNew ? 'new' : 'detail',
  };

  const heroSubtitleParts = [
    heroStyle?.style_name && heroStyle.style_name !== heroStyle.style_number ? heroStyle.style_name : null,
    heroStyle?.brand,
    heroStyle?.po_number,
  ].filter(Boolean);

  const detailHero = !isNew ? (
    <DetailHero
      image={<StyleImageUpload value={heroStyle?.style_image} onChange={() => {}} summary readOnly />}
      title={heroStyle?.style_number || '—'}
      subtitle={heroSubtitleParts.length > 0 ? heroSubtitleParts.join(' · ') : undefined}
      tags={(
        <>
          {summaryStatus && (
            <StatusPill status={CLOSING_STATUS_TONE[summaryStatus]}>
              {CLOSING_ORDER_STATUS_LABELS[summaryStatus]}
            </StatusPill>
          )}
          <StatusPill status={ZONE_STATUS[summaryZone]}>{ZONE_LABELS[summaryZone]}</StatusPill>
        </>
      )}
      kpiItems={buildHeroKpiItems(heroStyle, formatDateField)}
      stats={[
        {
          label: '加工产值',
          value: formatOutputValueNumber(summaryRow.processing_output_value ?? undefined),
          unit: '万美金',
          variant: 'default',
        },
        {
          label: '销售产值',
          value: formatOutputValueNumber(summaryRow.sales_output_value ?? undefined),
          unit: '万元',
          variant: 'success',
        },
      ]}
    />
  ) : undefined;

  return (
    <div className="page-container">
      <Form
        form={form}
        layout="vertical"
        initialValues={emptyForm()}
        className={styles.form}
      >
        <DetailPageLayout hero={detailHero}>
          {isNew ? (
            <SectionCard title="基本信息" flush>
              <IdentityFields {...identityFieldsProps} />
            </SectionCard>
          ) : (
            <Collapse
              ghost
              className={styles.basicCollapse}
              items={[{
                key: 'basic',
                label: '基本信息（展开编辑款号、品牌、关联月份等）',
                forceRender: true,
                children: <IdentityFields {...identityFieldsProps} />,
              }]}
            />
          )}

          <SectionCard title="物料" className={styles.sectionMaterial}>
            <div className={styles.materialGrid}>
              <Form.Item name="fabric_readiness" label="面料进度" className={fieldClass}>
                <Input.TextArea placeholder="面料进度" autoSize={{ minRows: 1, maxRows: 3 }} />
              </Form.Item>
              <Form.Item name="accessories_readiness" label="辅料进度" className={fieldClass}>
                <Input.TextArea placeholder="辅料进度" autoSize={{ minRows: 1, maxRows: 3 }} />
              </Form.Item>
              <Form.Item name="sample_progress" label="样衣进度" className={fieldClass}>
                <Input.TextArea placeholder="样衣进度" autoSize={{ minRows: 1, maxRows: 3 }} />
              </Form.Item>
              <Form.Item name="remarks" label="备注" className={fieldClass}>
                <Input.TextArea placeholder="备注" autoSize={{ minRows: 1, maxRows: 3 }} />
              </Form.Item>
            </div>
          </SectionCard>

          {isNew ? (
            <>
              <SectionCard title="价格">
                <div className={`${styles.grid} ${styles.gridSix}`}>
                  <Form.Item label="加工产值" className={fieldClass}>
                    <div className={styles.readonly}>{formatMoney(summaryRow.processing_output_value)}</div>
                  </Form.Item>
                  <Form.Item label="销售产值" className={fieldClass}>
                    <div className={styles.readonly}>{formatMoney(summaryRow.sales_output_value)}</div>
                  </Form.Item>
                </div>
              </SectionCard>

              <SectionCard title="排产进度">
                <div className={`${styles.grid} ${styles.gridSix}`}>
                  <Form.Item name="online_time" label="上线时间" className={fieldClass}>
                    <AutoFitDatePicker placeholder="上线" />
                  </Form.Item>
                  <Form.Item name="offline_time" label="下线时间" className={fieldClass}>
                    <AutoFitDatePicker placeholder="下线" />
                  </Form.Item>
                  <Form.Item name="required_days" label="所需天数" className={fieldClass}>
                    <InputNumber className="w-full" min={0} precision={0} />
                  </Form.Item>
                  <Form.Item name="first_bed_time" label="首床时间" className={fieldClass}>
                    <AutoFitDatePicker placeholder="首床" />
                  </Form.Item>
                  <Form.Item name="scheduled_output" label="排入数量" className={fieldClass}>
                    <InputNumber className="w-full" min={0} precision={0} />
                  </Form.Item>
                  <Form.Item name="avg_daily_output" label="日均产量" className={fieldClass}>
                    <InputNumber className="w-full" min={0} precision={0} />
                  </Form.Item>
                  <Form.Item name="group_name" label="排入组别" className={fieldClass}>
                    <AutoFitInput placeholder="组别" />
                  </Form.Item>
                  <Form.Item name="sort_order" label="排单顺位" className={fieldClass}>
                    <InputNumber className="w-full" min={0} precision={0} />
                  </Form.Item>
                  <Form.Item name="scheduling_remarks" label="排单备注" className={`${fieldClass} ${styles.spanThree}`}>
                    <Input.TextArea placeholder="排单备注" autoSize={{ minRows: 1, maxRows: 2 }} />
                  </Form.Item>
                </div>
              </SectionCard>

              <SectionCard title="外发">
                <div className={`${styles.grid} ${styles.gridSix}`}>
                  <Form.Item name="is_outsourced" label="是否外发" className={fieldClass}>
                    <Select options={yesNoOptions} />
                  </Form.Item>
                  <Form.Item name="outsourced_factory" label="外发工厂" className={fieldClass}>
                    <AutoFitInput placeholder="外发工厂" />
                  </Form.Item>
                  <Form.Item name="outsourced_price" label="外发单价" className={fieldClass}>
                    <InputNumber className="w-full" min={0} step={0.01} precision={2} />
                  </Form.Item>
                </div>
              </SectionCard>
            </>
          ) : (
            <StyleSchedulingReadOnlyPanel
              data={displayStyle ?? undefined}
              summaryRow={summaryRow}
              summaryZone={summaryZone}
              loadedMeta={loadedMeta}
              formatDateField={formatDateField}
            />
          )}

          {!isNew && loadedMeta && (
            <SectionCard title="系统信息">
              <div className={`${styles.grid} ${styles.gridSix} ${styles.systemGrid}`}>
                <ReadOnlyMetric label="ID" value={loadedMeta.id} />
                <ReadOnlyMetric
                  label="母款"
                  value={loadedMeta.parent_style_id ? (
                    <Button
                      type="link"
                      size="small"
                      className="!px-0 !h-auto"
                      onClick={() => navigate(`/scheduling/styles/${loadedMeta.parent_style_id}`, { state: location.state })}
                    >
                      {loadedMeta.parent_style_id}
                    </Button>
                  ) : '—'}
                />
                <ReadOnlyMetric
                  label="创建时间"
                  value={loadedMeta.created_at ? formatDateTimeBeijing(loadedMeta.created_at) : '—'}
                />
                <ReadOnlyMetric
                  label="更新时间"
                  value={loadedMeta.updated_at ? formatDateTimeBeijing(loadedMeta.updated_at) : '—'}
                />
              </div>
            </SectionCard>
          )}
        </DetailPageLayout>
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
