export type ClosingEditField = 'closing_month' | 'processing_unit_price';

export interface ClosingEditStep {
  id: string;
  styleId: number;
  styleNumber: string;
  field: ClosingEditField;
  label: string;
  before: string | number | undefined;
  after: string | number | undefined;
  timestamp: number;
  undone?: boolean;
}

export function formatEditStepLabel(
  field: ClosingEditField,
  before: string | number | undefined,
  after: string | number | undefined,
): string {
  if (field === 'closing_month') {
    return `关账月份 ${before ?? '—'} → ${after ?? '—'}`;
  }
  return `加工单价 ${before ?? '—'} → ${after ?? '—'}`;
}

export function createEditStep(
  styleId: number,
  styleNumber: string,
  field: ClosingEditField,
  before: string | number | undefined,
  after: string | number | undefined,
): ClosingEditStep {
  return {
    id: `${Date.now()}-${styleId}-${field}-${Math.random().toString(36).slice(2, 7)}`,
    styleId,
    styleNumber: styleNumber || `#${styleId}`,
    field,
    label: formatEditStepLabel(field, before, after),
    before,
    after,
    timestamp: Date.now(),
  };
}
