import { query, getClient } from '../config/database.js';
import {
  calcItemCost,
  calcGrossWidth,
  calcFabricConsumption,
  calcAccessoryAmount,
  resolveGrossWidth,
  type FabricInput,
  type AccessoryInput,
} from '../utils/calculation.js';
import { todayYmdBeijing, toYmdBeijing } from '../utils/beijingTime.js';
import {
  nextQuotationNo,
  nextItemNo,
  trackBrandUsage,
  trackFabricUsage,
  trackAccessoryUsage,
  getExchangeRate,
} from './sequenceService.js';

function parseOptionalPrice(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

interface FabricRow {
  fabric_id?: number;
  name?: string;
  composition?: string;
  weight?: number;
  net_width?: number;
  gross_width?: number;
  unit?: string;
  piece_length?: number;
  wastage?: number;
  unit_price?: number;
}

interface AccessoryRow {
  accessory_id?: number;
  name?: string;
  specification?: string;
  consumption?: number;
  wastage?: number;
  unit_price?: number;
}

interface ItemRow {
  id?: number;
  product_code?: string;
  version_label?: string;
  style_image?: string;
  delivery_date?: string;
  quantity?: number;
  description?: string;
  labor_cost_usd?: number;
  other_cost_rmb?: number;
  shipping_rmb?: number;
  fabrics?: FabricRow[];
  accessories?: AccessoryRow[];
  quantity_tiers?: Array<{ min_qty: number; max_qty?: number; price: number }>;
  sample_images?: string[];
  sample_videos?: string[];
  pattern_files?: string[];
  layout_files?: string[];
}

function computeFabricRow(f: FabricRow) {
  const grossWidth = resolveGrossWidth({
    netWidth: Number(f.net_width || 0),
    grossWidth: f.gross_width != null ? Number(f.gross_width) : undefined,
  });
  const input: FabricInput = {
    pieceLength: Number(f.piece_length || 0),
    wastage: Number(f.wastage ?? 5),
    unit: (f.unit as 'meter' | 'kg') || 'meter',
    netWidth: Number(f.net_width || 0),
    grossWidth,
    weight: Number(f.weight || 0),
    unitPrice: Number(f.unit_price || 0),
  };
  const consumption = calcFabricConsumption(input);
  return {
    ...f,
    gross_width: grossWidth,
    consumption: Math.round(consumption * 100) / 100,
    amount: Math.round(consumption * input.unitPrice * 100) / 100,
  };
}

function computeAccessoryRow(a: AccessoryRow) {
  const input: AccessoryInput = {
    consumption: Number(a.consumption ?? 1),
    wastage: Number(a.wastage ?? 5),
    unitPrice: Number(a.unit_price || 0),
  };
  return {
    ...a,
    amount: calcAccessoryAmount(input),
  };
}

function computeItemTotals(
  item: ItemRow,
  exchangeRate: number,
  currency: 'RMB' | 'USD',
  profitMargin: number
) {
  const fabrics = (item.fabrics || []).map(computeFabricRow);
  const accessories = (item.accessories || []).map(computeAccessoryRow);

  const result = calcItemCost(
    {
      laborCostUsd: Number(item.labor_cost_usd || 0),
      otherCostRmb: Number(item.other_cost_rmb || 0),
      shippingRmb: Number(item.shipping_rmb ?? 1),
      fabrics: fabrics.map((f) => ({
        pieceLength: Number(f.piece_length || 0),
        wastage: Number(f.wastage ?? 5),
        unit: (f.unit as 'meter' | 'kg') || 'meter',
        netWidth: Number(f.net_width || 0),
        grossWidth: Number(f.gross_width ?? calcGrossWidth(Number(f.net_width || 0))),
        weight: Number(f.weight || 0),
        unitPrice: Number(f.unit_price || 0),
      })),
      accessories: accessories.map((a) => ({
        consumption: Number(a.consumption ?? 1),
        wastage: Number(a.wastage ?? 5),
        unitPrice: Number(a.unit_price || 0),
      })),
    },
    exchangeRate,
    currency,
    profitMargin
  );

  return {
    fabricRows: fabrics,
    accessoryRows: accessories,
    fabricTotal: result.fabricTotal,
    accessoryTotal: result.accessoryTotal,
    laborRmb: result.laborRmb,
    subtotalRmb: result.subtotalRmb,
    finalPrice: result.finalPrice,
  };
}

type DbClient = Awaited<ReturnType<typeof getClient>>;

async function saveItemFabrics(itemId: number, fabrics: FabricRow[], dbClient?: DbClient) {
  const q = (text: string, params?: unknown[]) =>
    dbClient ? dbClient.query(text, params) : query(text, params);
  await q('DELETE FROM item_fabrics WHERE item_id = $1', [itemId]);
  for (let i = 0; i < fabrics.length; i++) {
    const f = computeFabricRow(fabrics[i]);
    await q(
      `INSERT INTO item_fabrics (item_id, fabric_id, name, composition, weight, net_width, gross_width,
        unit, piece_length, wastage, consumption, unit_price, amount, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        itemId, f.fabric_id || null, f.name, f.composition, f.weight, f.net_width, f.gross_width,
        f.unit || 'meter', f.piece_length, f.wastage ?? 5, f.consumption, f.unit_price, f.amount, i,
      ]
    );
    if (f.fabric_id) await trackFabricUsage(f.fabric_id);
  }
}

async function saveItemAccessories(itemId: number, accessories: AccessoryRow[], dbClient?: DbClient) {
  const q = (text: string, params?: unknown[]) =>
    dbClient ? dbClient.query(text, params) : query(text, params);
  await q('DELETE FROM item_accessories WHERE item_id = $1', [itemId]);
  for (let i = 0; i < accessories.length; i++) {
    const a = computeAccessoryRow(accessories[i]);
    await q(
      `INSERT INTO item_accessories (item_id, accessory_id, name, specification, consumption, wastage, unit_price, amount, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [itemId, a.accessory_id || null, a.name, a.specification || null, a.consumption ?? 1, a.wastage ?? 5, a.unit_price, a.amount, i]
    );
    if (a.accessory_id) await trackAccessoryUsage(a.accessory_id);
  }
}

async function saveItemTiers(itemId: number, tiers: Array<{ min_qty: number; max_qty?: number; price: number }>, dbClient?: DbClient) {
  const q = (text: string, params?: unknown[]) =>
    dbClient ? dbClient.query(text, params) : query(text, params);
  await q('DELETE FROM item_quantity_tiers WHERE item_id = $1', [itemId]);
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    await q(
      'INSERT INTO item_quantity_tiers (item_id, min_qty, max_qty, price, sort_order) VALUES ($1,$2,$3,$4,$5)',
      [itemId, t.min_qty, t.max_qty || null, t.price, i]
    );
  }
}

export async function getQuotationFull(id: number) {
  const qResult = await query(
    `SELECT q.*, b.name as brand_name FROM quotations q
     LEFT JOIN brands b ON q.brand_id = b.id WHERE q.id = $1`,
    [id]
  );
  if (!qResult.rows[0]) return null;

  const itemsResult = await query(
    'SELECT * FROM quotation_items WHERE quotation_id = $1 AND is_current = TRUE ORDER BY sort_order, id',
    [id]
  );

  const items = [];
  for (const item of itemsResult.rows) {
    const itemId = (item as { id: number }).id;
    const fabrics = await query('SELECT * FROM item_fabrics WHERE item_id = $1 ORDER BY sort_order', [itemId]);
    const accessories = await query('SELECT * FROM item_accessories WHERE item_id = $1 ORDER BY sort_order', [itemId]);
    const tiers = await query('SELECT * FROM item_quantity_tiers WHERE item_id = $1 ORDER BY sort_order', [itemId]);
    items.push({
      ...item,
      fabrics: fabrics.rows,
      accessories: accessories.rows,
      quantity_tiers: tiers.rows,
    });
  }

  return { ...qResult.rows[0], items };
}

async function validateAgentForBrand(brandId: number, agentName: string | undefined, dbClient?: DbClient) {
  if (!brandId || !agentName) return;
  // #region agent log
  const { debugLog } = await import('../utils/debugLog.js');
  debugLog('quotationService.ts:validateAgentForBrand', 'validating agent', {
    brandId,
    agentName,
    hasDbClient: !!dbClient,
    queryThisLost: dbClient ? dbClient.query !== dbClient.query.bind(dbClient) : false,
  }, 'B');
  // #endregion
  const result = dbClient
    ? await dbClient.query(
        `SELECT 1 FROM agents a
     WHERE a.brand_id = $1 AND a.name = $2`,
        [brandId, agentName]
      )
    : await query(
        `SELECT 1 FROM agents a
     WHERE a.brand_id = $1 AND a.name = $2`,
        [brandId, agentName]
      );
  if (result.rows.length === 0) {
    throw new Error('所选业务员未关联到该品牌');
  }
}

async function resolveAgentName(
  brandId: number | null | undefined,
  agentName: string | undefined,
  dbClient: { query: typeof query }
): Promise<string> {
  if (agentName) return agentName;
  if (!brandId) return '';
  const result = await dbClient.query(
    `SELECT a.name FROM agents a
     WHERE a.brand_id = $1
     ORDER BY a.name ASC
     LIMIT 1`,
    [brandId]
  );
  return (result.rows[0] as { name?: string } | undefined)?.name || '';
}

export async function createQuotation(data: Record<string, unknown>) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const exchangeRate = data.exchange_rate
      ? Number(data.exchange_rate)
      : await getExchangeRate();
    const quoteDateYmd = data.quote_date
      ? (toYmdBeijing(data.quote_date as string) ?? todayYmdBeijing())
      : todayYmdBeijing();
    const fabricDeliveryDate = data.fabric_delivery_date
      ? (data.fabric_delivery_date as string)
      : null;
    const garmentDeliveryDate = data.garment_delivery_date
      ? (data.garment_delivery_date as string)
      : null;

    let agentName = await resolveAgentName(
      data.brand_id ? Number(data.brand_id) : undefined,
      data.agent_name as string | undefined,
      client
    );
    if (data.brand_id && agentName) {
      await validateAgentForBrand(Number(data.brand_id), agentName, client);
    }

    const quotationNo = await nextQuotationNo();

    const qResult = await client.query(
      `INSERT INTO quotations (quotation_no, brand_id, agent_name, currency, exchange_rate,
        quote_date, fabric_delivery_date, garment_delivery_date,
        target_labor_price, target_garment_price, confirmed_labor_price, confirmed_garment_price,
        profit_margin, remarks, style_image, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [
        quotationNo, data.brand_id || null, agentName,
        data.currency || 'RMB', Math.round(exchangeRate * 100) / 100,
        quoteDateYmd,
        fabricDeliveryDate,
        garmentDeliveryDate,
        parseOptionalPrice(data.target_labor_price),
        parseOptionalPrice(data.target_garment_price),
        parseOptionalPrice(data.confirmed_labor_price),
        parseOptionalPrice(data.confirmed_garment_price),
        data.profit_margin ?? 5, data.remarks || null,
        data.style_image || null,
        data.status || 'draft', data.created_by || 'system',
      ]
    );

    const quotationId = (qResult.rows[0] as { id: number }).id;

    if (data.brand_id) {
      await trackBrandUsage(Number(data.brand_id));
    }

    const items = (data.items as ItemRow[]) || [];
    for (let i = 0; i < items.length; i++) {
      await saveQuotationItem(client, quotationId, items[i], i, exchangeRate, (data.currency as 'RMB' | 'USD') || 'RMB', Number(data.profit_margin ?? 5));
    }

    await client.query('COMMIT');
    return getQuotationFull(quotationId);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function saveQuotationItem(
  client: Awaited<ReturnType<typeof getClient>>,
  quotationId: number,
  item: ItemRow,
  sortOrder: number,
  exchangeRate: number,
  currency: 'RMB' | 'USD',
  profitMargin: number
) {
  const computed = computeItemTotals(item, exchangeRate, currency, profitMargin);
  const itemNo = await nextItemNo();

  const result = await client.query(
    `INSERT INTO quotation_items (quotation_id, item_no, product_code, version_label, style_image,
      delivery_date, quantity, description, labor_cost_usd, other_cost_rmb, shipping_rmb,
      fabric_total, accessory_total, labor_rmb, subtotal_rmb, final_price, version, is_current,
      sample_images, sample_videos, pattern_files, layout_files, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,1,TRUE,$17,$18,$19,$20,$21) RETURNING id`,
    [
      quotationId, itemNo, item.product_code, item.version_label, item.style_image,
      item.delivery_date, item.quantity ?? 0, item.description,
      item.labor_cost_usd ?? 0, item.other_cost_rmb ?? 0, item.shipping_rmb ?? 1,
      computed.fabricTotal, computed.accessoryTotal, computed.laborRmb,
      computed.subtotalRmb, computed.finalPrice,
      JSON.stringify(item.sample_images || []),
      JSON.stringify(item.sample_videos || []),
      JSON.stringify(item.pattern_files || []),
      JSON.stringify(item.layout_files || []),
      sortOrder,
    ]
  );

  const itemId = (result.rows[0] as { id: number }).id;
  await saveItemFabrics(itemId, computed.fabricRows, client);
  await saveItemAccessories(itemId, computed.accessoryRows, client);
  await saveItemTiers(itemId, item.quantity_tiers || [], client);

  // 自动沉淀面料/辅料到库
  for (const f of computed.fabricRows) {
    if (!f.fabric_id && f.name) {
      const existing = await client.query(
        'SELECT id FROM fabric_library WHERE name = $1 LIMIT 1',
        [f.name]
      );
      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO fabric_library (name, composition, weight, net_width, unit, reference_price)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [f.name, f.composition, f.weight, f.net_width, f.unit || 'meter', f.unit_price]
        );
      }
    }
  }
  for (const a of computed.accessoryRows) {
    if (!a.accessory_id && a.name) {
      const existing = await client.query(
        'SELECT id FROM accessory_library WHERE name = $1 LIMIT 1',
        [a.name]
      );
      if (existing.rows.length === 0) {
        await client.query(
          'INSERT INTO accessory_library (name, reference_price) VALUES ($1, $2)',
          [a.name, a.unit_price]
        );
      }
    }
  }
}

export async function updateQuotation(id: number, data: Record<string, unknown>) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const exchangeRate = data.exchange_rate ? Number(data.exchange_rate) : await getExchangeRate();
    const currency = (data.currency as 'RMB' | 'USD') || 'RMB';
    const profitMargin = Number(data.profit_margin ?? 5);

    const agentName = data.agent_name as string | undefined;
    if (data.brand_id && agentName) {
      await validateAgentForBrand(Number(data.brand_id), agentName, client);
      await trackBrandUsage(Number(data.brand_id));
    }

    await client.query(
      `UPDATE quotations SET brand_id = COALESCE($1, brand_id), agent_name = COALESCE($2, agent_name),
        currency = COALESCE($3, currency), exchange_rate = $4, quote_date = COALESCE($5, quote_date),
        fabric_delivery_date = COALESCE($6, fabric_delivery_date),
        garment_delivery_date = COALESCE($7, garment_delivery_date),
        target_labor_price = $8,
        target_garment_price = $9,
        confirmed_labor_price = $10,
        confirmed_garment_price = $11,
        profit_margin = COALESCE($12, profit_margin),
        remarks = COALESCE($13, remarks), style_image = COALESCE($14, style_image),
        status = COALESCE($15, status), updated_at = NOW()
       WHERE id = $16`,
      [
        data.brand_id, agentName, data.currency, Math.round(exchangeRate * 100) / 100,
        data.quote_date, data.fabric_delivery_date, data.garment_delivery_date,
        parseOptionalPrice(data.target_labor_price),
        parseOptionalPrice(data.target_garment_price),
        parseOptionalPrice(data.confirmed_labor_price),
        parseOptionalPrice(data.confirmed_garment_price),
        data.profit_margin,
        data.remarks, data.style_image, data.status, id,
      ]
    );

    if (data.items) {
      await client.query('DELETE FROM quotation_items WHERE quotation_id = $1', [id]);
      const items = data.items as ItemRow[];
      for (let i = 0; i < items.length; i++) {
        await saveQuotationItem(client, id, items[i], i, exchangeRate, currency, profitMargin);
      }
    }

    await client.query('COMMIT');
    return getQuotationFull(id);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function copyQuotation(id: number) {
  const original = await getQuotationFull(id);
  if (!original) throw new Error('Quotation not found');

  const copyData = {
    ...original,
    id: undefined,
    quotation_no: undefined,
    status: 'draft',
    items: (original as { items: ItemRow[] }).items.map((item) => ({
      ...item,
      id: undefined,
      item_no: undefined,
    })),
  };

  return createQuotation(copyData as Record<string, unknown>);
}

export async function reviseItem(itemId: number, data: ItemRow, updateNote?: string) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const itemResult = await client.query('SELECT * FROM quotation_items WHERE id = $1', [itemId]);
    if (!itemResult.rows[0]) throw new Error('Item not found');

    const item = itemResult.rows[0] as Record<string, unknown>;
    const quotationId = item.quotation_id as number;

    const qResult = await client.query('SELECT * FROM quotations WHERE id = $1', [quotationId]);
    const quotation = qResult.rows[0] as Record<string, unknown>;

    // 保存快照
    const fabrics = await client.query('SELECT * FROM item_fabrics WHERE item_id = $1', [itemId]);
    const accessories = await client.query('SELECT * FROM item_accessories WHERE item_id = $1', [itemId]);
    const tiers = await client.query('SELECT * FROM item_quantity_tiers WHERE item_id = $1', [itemId]);

    await client.query(
      `INSERT INTO item_version_snapshots (item_id, version, data, update_note)
       VALUES ($1, $2, $3, $4)`,
      [
        itemId,
        item.version,
        JSON.stringify({ ...item, fabrics: fabrics.rows, accessories: accessories.rows, tiers: tiers.rows }),
        updateNote || '版本修订',
      ]
    );

    const newVersion = (item.version as number) + 1;
    const computed = computeItemTotals(
      data,
      Number(quotation.exchange_rate),
      quotation.currency as 'RMB' | 'USD',
      Number(quotation.profit_margin)
    );

    await client.query(
      `UPDATE quotation_items SET
        product_code = COALESCE($1, product_code), version_label = COALESCE($2, version_label),
        labor_cost_usd = $3, other_cost_rmb = $4, shipping_rmb = $5,
        fabric_total = $6, accessory_total = $7, labor_rmb = $8, subtotal_rmb = $9, final_price = $10,
        version = $11, updated_at = NOW()
       WHERE id = $12`,
      [
        data.product_code, data.version_label,
        data.labor_cost_usd ?? 0, data.other_cost_rmb ?? 0, data.shipping_rmb ?? 1,
        computed.fabricTotal, computed.accessoryTotal, computed.laborRmb,
        computed.subtotalRmb, computed.finalPrice,
        newVersion, itemId,
      ]
    );

    await saveItemFabrics(itemId, computed.fabricRows, client);
    await saveItemAccessories(itemId, computed.accessoryRows, client);
    if (data.quantity_tiers) await saveItemTiers(itemId, data.quantity_tiers, client);

    await client.query('COMMIT');
    return getQuotationFull(quotationId);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function buildExportData(quotationId: number): Promise<Record<string, unknown>> {
  const quotation = await getQuotationFull(quotationId);
  if (!quotation) throw new Error('Quotation not found');

  const q = quotation as Record<string, unknown>;
  return {
    quotation_no: q.quotation_no as string,
    brand_name: q.brand_name as string,
    agent_name: q.agent_name as string,
    currency: q.currency as string,
    exchange_rate: q.exchange_rate as number,
    quote_date: q.quote_date as string,
    fabric_delivery_date: q.fabric_delivery_date as string,
    garment_delivery_date: q.garment_delivery_date as string,
    target_labor_price: q.target_labor_price as number,
    target_garment_price: q.target_garment_price as number,
    confirmed_labor_price: q.confirmed_labor_price as number,
    confirmed_garment_price: q.confirmed_garment_price as number,
    profit_margin: q.profit_margin as number,
    remarks: q.remarks as string,
    items: ((quotation as { items: Array<Record<string, unknown>> }).items || []).map((item) => ({
      ...item,
      fabrics: (item.fabrics as Array<Record<string, unknown>>) || [],
      accessories: (item.accessories as Array<Record<string, unknown>>) || [],
      quantity_tiers: (item.quantity_tiers as Array<Record<string, unknown>>) || [],
    })),
  };
}

export { computeItemTotals, computeFabricRow, computeAccessoryRow };
