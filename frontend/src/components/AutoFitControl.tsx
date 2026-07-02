import { useEffect, useRef, useState, forwardRef, type CSSProperties, type ReactElement, cloneElement, isValidElement } from 'react';
import { Input, InputNumber, Select, DatePicker } from 'antd';
import type { GetRef, InputProps, InputNumberProps, SelectProps, DatePickerProps } from 'antd';
import dayjs from 'dayjs';

type InputRef = GetRef<typeof Input>;
type InputNumberRef = GetRef<typeof InputNumber>;

const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const WIDTH_PADDING = 32;

function useAutoWidth(text: string) {
  const measureRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(MIN_WIDTH);

  useEffect(() => {
    if (!measureRef.current) return;
    measureRef.current.textContent = text || ' ';
    const measured = measureRef.current.offsetWidth + WIDTH_PADDING;
    setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, measured)));
  }, [text]);

  return { measureRef, width };
}

function AutoFitShell({
  text,
  children,
}: {
  text: string;
  children: ReactElement<{ style?: CSSProperties }>;
}) {
  const { measureRef, width } = useAutoWidth(text);

  return (
    <div className="auto-fit-control" style={{ width }}>
      <span ref={measureRef} className="auto-fit-measure" aria-hidden />
      {isValidElement(children)
        ? cloneElement(children, {
            style: { width: '100%', ...children.props.style },
          })
        : children}
    </div>
  );
}

export const AutoFitInput = forwardRef<InputRef, InputProps>(function AutoFitInput(
  { value, placeholder, ...rest },
  ref,
) {
  const display = value != null && String(value) !== '' ? String(value) : (placeholder ?? '');
  return (
    <AutoFitShell text={display}>
      <Input ref={ref} value={value} placeholder={placeholder} {...rest} />
    </AutoFitShell>
  );
});

export const AutoFitInputNumber = forwardRef<InputNumberRef, InputNumberProps>(function AutoFitInputNumber(
  { value, placeholder, ...rest },
  ref,
) {
  const display = value != null && value !== '' ? String(value) : (placeholder ?? '');
  return (
    <AutoFitShell text={display}>
      <InputNumber ref={ref} value={value} placeholder={placeholder} {...rest} />
    </AutoFitShell>
  );
});

export function AutoFitSelect<ValueType = string>({
  value,
  placeholder,
  options,
  ...rest
}: SelectProps<ValueType>) {
  const optionLabel = options?.find((o) => {
    if ('value' in o && o.value === value) return true;
    return false;
  });
  const label = optionLabel && 'label' in optionLabel
    ? String(optionLabel.label ?? '')
    : value != null && String(value) !== ''
      ? String(value)
      : String(placeholder ?? '');

  return (
    <AutoFitShell text={label}>
      <Select<ValueType> value={value} placeholder={placeholder} options={options} {...rest} />
    </AutoFitShell>
  );
}

export function AutoFitDatePicker({
  value,
  placeholder,
  format = 'YYYY-MM-DD',
  ...rest
}: DatePickerProps) {
  const formatStr = typeof format === 'string' ? format : 'YYYY-MM-DD';
  const display = value
    ? dayjs(value as dayjs.Dayjs).format(formatStr)
    : (placeholder ?? '');

  return (
    <AutoFitShell text={display}>
      <DatePicker value={value} placeholder={placeholder} format={format} {...rest} />
    </AutoFitShell>
  );
}
