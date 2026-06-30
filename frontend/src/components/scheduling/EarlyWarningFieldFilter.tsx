import { useCallback, useEffect, useState } from 'react';
import { Select, Space } from 'antd';
import FieldCheckboxSelect from '@/components/FieldCheckboxSelect';
import { getStyleFieldOptions } from '@/api/styles';
import {
  EARLY_WARNING_FILTER_FIELD_OPTIONS,
  DEFAULT_FIELD_FILTER_FIELD,
  type EarlyWarningFilterField,
  type FieldFilterState,
} from '@/utils/earlyWarningFieldFilter';
import { closingMonthRangeToCsv, type ClosingMonthRange } from '@/utils/closingMonthRange';

interface EarlyWarningFieldFilterProps {
  value: FieldFilterState | null;
  onChange: (next: FieldFilterState | null) => void;
  closingMonthRange: ClosingMonthRange;
  unscheduledOnly: boolean;
  disabled?: boolean;
}

export default function EarlyWarningFieldFilter({
  value,
  onChange,
  closingMonthRange,
  unscheduledOnly,
  disabled = false,
}: EarlyWarningFieldFilterProps) {
  const [field, setField] = useState<EarlyWarningFilterField>(value?.field ?? DEFAULT_FIELD_FILTER_FIELD);
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (value?.field) setField(value.field);
  }, [value?.field]);

  const loadOptions = useCallback(async (keyword: string) => {
    setLoading(true);
    try {
      const res = await getStyleFieldOptions({
        field,
        view: 'early_warning',
        closing_month: closingMonthRangeToCsv(closingMonthRange) || undefined,
        unscheduled_only: unscheduledOnly || undefined,
        q: keyword || undefined,
      });
      setOptions(res.data || []);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [field, closingMonthRange, unscheduledOnly]);

  const handleLoadOptions = useCallback((keyword: string) => {
    void loadOptions(keyword);
  }, [loadOptions]);

  const handleFieldChange = (nextField: EarlyWarningFilterField) => {
    setField(nextField);
    onChange(null);
    setOptions([]);
  };

  const handleValuesChange = (values: string[]) => {
    if (values.length === 0) {
      onChange(null);
    } else {
      onChange({ field, values });
    }
  };

  return (
    <Space.Compact>
      <Select
        value={value?.field ?? field}
        options={EARLY_WARNING_FILTER_FIELD_OPTIONS}
        style={{ width: 100 }}
        disabled={disabled}
        onChange={handleFieldChange}
      />
      <FieldCheckboxSelect
        key={field}
        options={options}
        loading={loading}
        value={value?.field === field ? value.values : []}
        onChange={handleValuesChange}
        onLoadOptions={handleLoadOptions}
        placeholder="请选择"
        disabled={disabled}
      />
    </Space.Compact>
  );
}
