import { describe, it, expect } from 'vitest';
import type { QuotationItem } from '@/types';
import {
  buildVersionGroups,
  cloneItemFromSource,
  ensureVersionGroupKeys,
  stripClientItemFields,
} from './quotationVersionGroups';

function item(partial: Partial<QuotationItem> & { product_code?: string }): QuotationItem {
  return {
    product_code: partial.product_code ?? 'STYLE-1',
    quantity: partial.quantity ?? 100,
    labor_cost_usd: partial.labor_cost_usd ?? 1,
    fabrics: [],
    accessories: [],
    ...partial,
  } as QuotationItem;
}

describe('ensureVersionGroupKeys', () => {
  it('groups consecutive version rows sharing product code', () => {
    const items = ensureVersionGroupKeys([
      item({ product_code: 'D1821', version_label: 'V1' }),
      item({ product_code: 'D1821', version_label: 'V2' }),
      item({ product_code: 'OTHER' }),
    ]);

    expect(items[0].version_group_key).toBeTruthy();
    expect(items[1].version_group_key).toBe(items[0].version_group_key);
    expect(items[2].version_group_key).not.toBe(items[0].version_group_key);
  });
});

describe('buildVersionGroups', () => {
  it('collects indices per version_group_key', () => {
    const items = [
      item({ version_group_key: 'g1' }),
      item({ version_group_key: 'g1' }),
      item({ version_group_key: 'g2' }),
    ];
    const groups = buildVersionGroups(items);

    expect(groups).toHaveLength(2);
    expect(groups[0].indices).toEqual([0, 1]);
    expect(groups[1].indices).toEqual([2]);
  });
});

describe('cloneItemFromSource', () => {
  it('deep clones nested arrays and clears id', () => {
    const source = item({
      id: 99,
      fabrics: [{ name: '棉', unit_price: 1 } as QuotationItem['fabrics'][0]],
      quantity_tiers: [{ min_qty: 1, price: 2 } as never],
    });

    const cloned = cloneItemFromSource(source, { version_label: 'V2', quantity: 200 });

    expect(cloned.id).toBeUndefined();
    expect(cloned.version_label).toBe('V2');
    expect(cloned.quantity).toBe(200);
    expect(cloned.fabrics).not.toBe(source.fabrics);
    expect(cloned.quantity_tiers).toEqual([]);
  });
});

describe('stripClientItemFields', () => {
  it('removes client-only version fields', () => {
    const cleaned = stripClientItemFields(item({
      version_group_key: 'g1',
      showVersionLabel: true,
    } as QuotationItem));

    expect('version_group_key' in cleaned).toBe(false);
    expect('showVersionLabel' in cleaned).toBe(false);
    expect(cleaned.product_code).toBe('STYLE-1');
  });
});
