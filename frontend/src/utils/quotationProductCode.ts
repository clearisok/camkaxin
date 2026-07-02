import type { QuotationItem } from '@/types';

export const VERSION_TAG_COLORS = ['green', 'orange', 'purple', 'cyan', 'magenta', 'gold', 'lime'] as const;

export function getVersionTagColor(index: number): string {
  return VERSION_TAG_COLORS[index % VERSION_TAG_COLORS.length];
}

/** 从已保存明细反推报价单级款号 */
export function deriveQuotationProductCode(items: QuotationItem[] | undefined): string {
  if (!items?.length) return '';
  const codes = items.map((it) => it.product_code?.trim() || '').filter(Boolean);
  if (!codes.length) return '';

  const unique = [...new Set(codes)];
  if (unique.length === 1) return unique[0];

  const base = codes[0].replace(/-\d+$/, '');
  const numbered = codes.every((code, i) => code === `${base}-${i + 1}`);
  if (numbered && base) return base;

  return codes[0];
}

export function buildItemProductCode(base: string): string {
  return base.trim();
}

export function applyProductCodeToItems(
  items: QuotationItem[],
  baseCode: string,
): QuotationItem[] {
  const code = buildItemProductCode(baseCode);
  return items.map((item) => ({
    ...item,
    product_code: code || item.product_code,
  }));
}
