import { Input, InputNumber, Select, DatePicker, Switch } from 'antd';
import dayjs from 'dayjs';
import type { Brand } from '@/types';
import type { StyleRecord } from '@/types/style';
import { formatDateBeijing } from '@/utils/beijingTime';
import ClosingMonthSelect from '@/components/scheduling/ClosingMonthSelect';
import { defaultClosingMonth } from '@/utils/schedulingFilters';
import { GROUP_OPTIONS, SHORT_OVER_OPTIONS } from '@/utils/styleFieldOptions';

interface CellProps {
  record: StyleRecord;
  field: keyof StyleRecord;
  updateLocal: (id: number, patch: Partial<StyleRecord>) => void;
  saveField: (id: number, patch: Record<string, unknown>) => void;
  savingId?: number | null;
}

export function StyleTextCell({
  record, field, updateLocal, saveField, savingId, placeholder,
}: CellProps & { placeholder?: string }) {
  const value = record[field] as string | undefined;
  return (
    <Input
      size="small"
      className="scheduling-inline-input"
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => updateLocal(record.id, { [field]: e.target.value } as Partial<StyleRecord>)}
      onBlur={() => {
        const val = String(record[field] ?? '').trim();
        const prev = String(value ?? '').trim();
        if (val !== prev) saveField(record.id, { [field]: val || null });
      }}
      disabled={savingId === record.id}
    />
  );
}

export function StyleNumberCell({
  record, field, updateLocal, saveField, savingId, min = 0, step = 1, precision,
}: CellProps & { min?: number; step?: number; precision?: number }) {
  const value = record[field] as number | undefined;
  return (
    <InputNumber
      size="small"
      className="scheduling-inline-input w-full"
      value={value}
      min={min}
      step={step}
      precision={precision}
      onChange={(val) => updateLocal(record.id, { [field]: val ?? undefined } as Partial<StyleRecord>)}
      onBlur={() => saveField(record.id, { [field]: (record[field] as number | undefined) ?? null })}
      disabled={savingId === record.id}
    />
  );
}

export function StyleDateCell({ record, field, updateLocal, saveField, savingId }: CellProps) {
  const raw = record[field] as string | undefined;
  const ymd = raw ? formatDateBeijing(raw) : undefined;
  return (
    <DatePicker
      size="small"
      className="scheduling-inline-input w-full"
      value={ymd && ymd !== '—' ? dayjs(ymd) : undefined}
      format="YYYY-MM-DD"
      onChange={(d) => {
        const val = d ? d.format('YYYY-MM-DD') : undefined;
        updateLocal(record.id, { [field]: val } as Partial<StyleRecord>);
        saveField(record.id, { [field]: val ?? null });
      }}
      disabled={savingId === record.id}
    />
  );
}

export function StyleSelectCell({
  record, field, updateLocal, saveField, savingId, options, allowClear = true, placeholder,
}: CellProps & {
  options: Array<{ value: string; label: string }>;
  allowClear?: boolean;
  placeholder?: string;
}) {
  const value = record[field] as string | undefined;
  return (
    <Select
      size="small"
      className="scheduling-inline-input w-full"
      value={value || undefined}
      placeholder={placeholder}
      allowClear={allowClear}
      options={options}
      onChange={(val) => {
        updateLocal(record.id, { [field]: val } as Partial<StyleRecord>);
        saveField(record.id, { [field]: val ?? null });
      }}
      loading={savingId === record.id}
    />
  );
}

export function StyleTextAreaCell({
  record, field, updateLocal, saveField, savingId, placeholder, minRows = 1, maxRows = 4,
}: CellProps & { placeholder?: string; minRows?: number; maxRows?: number }) {
  const value = record[field] as string | undefined;
  return (
    <Input.TextArea
      size="small"
      className="scheduling-inline-textarea"
      value={value ?? ''}
      placeholder={placeholder}
      autoSize={{ minRows, maxRows }}
      onChange={(e) => updateLocal(record.id, { [field]: e.target.value } as Partial<StyleRecord>)}
      onBlur={() => {
        const val = String(record[field] ?? '').trim();
        const prev = String(value ?? '').trim();
        if (val !== prev) saveField(record.id, { [field]: val || null });
      }}
      disabled={savingId === record.id}
    />
  );
}

export function StyleClosingMonthCell({
  record, field, updateLocal, saveField, savingId,
}: CellProps) {
  const value = record[field] as string | undefined;
  return (
    <ClosingMonthSelect
      size="small"
      className="scheduling-inline-input w-full"
      value={value || undefined}
      placeholder="关账月份"
      scrollToMonth={record.closing_month || defaultClosingMonth()}
      onChange={(val) => {
        updateLocal(record.id, { [field]: val } as Partial<StyleRecord>);
        saveField(record.id, { [field]: val ?? null });
      }}
      loading={savingId === record.id}
    />
  );
}

export function StyleBrandCell({
  record, updateLocal, saveField, savingId, brands,
}: Omit<CellProps, 'field'> & { brands: Brand[] }) {
  const options = brands.map((b) => ({ value: b.name, label: b.name }));
  const value = record.brand;
  return (
    <Select
      size="small"
      className="scheduling-inline-input w-full"
      showSearch
      allowClear
      value={value || undefined}
      placeholder="品牌"
      options={options}
      filterOption={(input, option) =>
        String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
      }
      onChange={(val) => {
        const brand = brands.find((b) => b.name === val);
        const linked = brand?.agents || [];
        const patch: Partial<StyleRecord> = { brand: val };
        if (record.salesperson && !linked.some((a) => a.name === record.salesperson)) {
          patch.salesperson = linked.length === 1 ? linked[0].name : undefined;
        } else if (!record.salesperson && linked.length === 1) {
          patch.salesperson = linked[0].name;
        }
        updateLocal(record.id, patch);
        saveField(record.id, {
          brand: val ?? null,
          ...(patch.salesperson !== undefined ? { salesperson: patch.salesperson ?? null } : {}),
        });
      }}
      loading={savingId === record.id}
    />
  );
}

export function StyleSalespersonCell({
  record, updateLocal, saveField, savingId, brands,
}: Omit<CellProps, 'field'> & { brands: Brand[] }) {
  const brand = brands.find((b) => b.name === record.brand);
  const options = (brand?.agents || []).map((a) => ({ value: a.name, label: a.name }));
  const value = record.salesperson as string | undefined;
  return (
    <Select
      size="small"
      className="scheduling-inline-input w-full"
      allowClear
      disabled={!record.brand || options.length === 0 || savingId === record.id}
      value={value || undefined}
      placeholder={record.brand ? '业务员' : '先选品牌'}
      options={options}
      onChange={(val) => {
        updateLocal(record.id, { salesperson: val });
        saveField(record.id, { salesperson: val ?? null });
      }}
      loading={savingId === record.id}
    />
  );
}

export function StyleGroupCell(props: CellProps) {
  return (
    <StyleSelectCell
      {...props}
      options={GROUP_OPTIONS.map((g) => ({ value: g, label: g }))}
      placeholder="组别"
    />
  );
}

export function StyleShortOverCell(props: CellProps) {
  return <StyleSelectCell {...props} options={SHORT_OVER_OPTIONS} placeholder="短溢装" />;
}

export function StyleOutsourceSwitch({
  record, updateLocal, saveField, savingId,
}: Omit<CellProps, 'field'>) {
  return (
    <Switch
      size="small"
      checked={!!record.is_outsourced}
      checkedChildren="是"
      unCheckedChildren="否"
      onChange={(checked) => {
        updateLocal(record.id, { is_outsourced: checked });
        saveField(record.id, { is_outsourced: checked });
      }}
      disabled={savingId === record.id}
    />
  );
}
