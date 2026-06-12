import { query, getClient } from '../config/database.js';
import {
  EDITABLE_STYLE_FIELDS,
  enrichStyle,
  type StyleRow,
} from '../utils/styleCalculations.js';
import { normalizeZonePatch, todayYmd } from '../utils/schedulingZone.js';
import {
  calcUnscheduledQuantity,
  effectiveAllocatedQuantity,
  loadAllocatedMap,
} from './styleAllocation.js';

export interface StyleListQuery {
  view?: 'early_warning' | 'scheduling' | 'closing';
  closing_month?: string;
  brand?: string;
  salesperson?: string;
  group?: string;
  unscheduled_only?: boolean;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

function parseCsvFilter(value?: string): string[] {
  if (!value?.trim()) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

const STYLE_SORTABLE_FIELDS = new Set([
  'style_number', 'brand', 'quantity', 'style_name', 'salesperson', 'po_number',
  'closing_month', 'required_shipping_date', 'processing_unit_price', 'sales_price',
  'processing_output_value', 'sales_output_value', 'created_at', 'updated_at',
]);

function normalizeValue(key: string, value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === '' || value === null) return null;
  if (['first_bed_time', 'online_time', 'offline_time', 'required_shipping_date'].includes(key)) {
    return value;
  }
  if (['quantity', 'scheduled_output', 'avg_daily_output'].includes(key)) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  if (['processing_unit_price', 'sales_price', 'outsourced_price'].includes(key)) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  }
  if (key === 'is_outsourced') return Boolean(value);
  if (key === 'sort_order' || key === 'required_days') {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  if (key === 'scheduling_zone') return String(value);
  return value;
}

function pickUpdates(data: Record<string, unknown>): Record<string, unknown> {
  const withZone = ('scheduling_zone' in data || 'group_name' in data)
    ? normalizeZonePatch(data)
    : data;
  const updates: Record<string, unknown> = {};
  for (const key of EDITABLE_STYLE_FIELDS) {
    if (key in withZone) updates[key] = normalizeValue(key, withZone[key]);
  }
  return updates;
}

function buildDiff(
  oldRow: Record<string, unknown>,
  updates: Record<string, unknown>
): Record<string, { old: unknown; new: unknown }> {
  const diff: Record<string, { old: unknown; new: unknown }> = {};
  for (const [key, newVal] of Object.entries(updates)) {
    const oldVal = oldRow[key];
    const oldStr = oldVal instanceof Date ? oldVal.toISOString().slice(0, 10) : oldVal;
    const newStr = newVal instanceof Date ? newVal.toISOString().slice(0, 10) : newVal;
    if (String(oldStr ?? '') !== String(newStr ?? '')) {
      diff[key] = { old: oldVal ?? null, new: newVal ?? null };
    }
  }
  return diff;
}

/** 生产规则：offline_time 早于今天（不含今天）且仍在产线/外发 → 自动进下线区 */
export async function applyAutoOfflineRules() {
  const today = todayYmd();
  const result = await query(
    `UPDATE styles SET
      scheduling_zone = 'offline',
      group_name = NULL,
      updated_at = NOW()
     WHERE scheduling_zone IN ('group', 'outsource')
       AND offline_time IS NOT NULL
       AND offline_time < $1::date
     RETURNING id`,
    [today],
  );
  return result.rowCount ?? 0;
}

export async function listStyles(params: StyleListQuery) {
  if (params.view === 'scheduling') {
    await applyAutoOfflineRules();
  }

  let where = 'WHERE 1=1';

  if (params.view === 'early_warning' || params.view === 'closing') {
    where += ' AND parent_style_id IS NULL';
  } else if (params.view === 'scheduling') {
    where += ` AND (
      parent_style_id IS NOT NULL
      OR (parent_style_id IS NULL AND scheduling_zone = 'wait')
      OR (parent_style_id IS NULL AND scheduling_zone NOT IN ('wait'))
    )`;
  }
  const values: unknown[] = [];
  let idx = 1;

  // scheduling：加载全部区位（待排 + 各组 + 外发 + 下线），不再过滤 group_name
  const closingMonths = parseCsvFilter(params.closing_month);
  if (closingMonths.length === 1) {
    where += ` AND closing_month = $${idx++}`;
    values.push(closingMonths[0]);
  } else if (closingMonths.length > 1) {
    where += ` AND closing_month = ANY($${idx++}::text[])`;
    values.push(closingMonths);
  }

  const brands = parseCsvFilter(params.brand);
  if (brands.length === 1) {
    where += ` AND brand = $${idx++}`;
    values.push(brands[0]);
  } else if (brands.length > 1) {
    where += ` AND brand = ANY($${idx++}::text[])`;
    values.push(brands);
  }

  const salespersons = parseCsvFilter(params.salesperson);
  if (salespersons.length === 1) {
    where += ` AND salesperson = $${idx++}`;
    values.push(salespersons[0]);
  } else if (salespersons.length > 1) {
    where += ` AND salesperson = ANY($${idx++}::text[])`;
    values.push(salespersons);
  }
  if (params.group) {
    where += ` AND group_name = $${idx++}`;
    values.push(params.group);
  }
  if (params.unscheduled_only) {
    where += ` AND parent_style_id IS NULL AND scheduling_zone = 'wait' AND COALESCE(quantity, 0) > COALESCE((
      SELECT SUM(c.scheduled_output) FROM styles c WHERE c.parent_style_id = styles.id
    ), 0)`;
  }
  if (params.search) {
    where += ` AND (
      style_number ILIKE $${idx} OR style_name ILIKE $${idx}
      OR brand ILIKE $${idx} OR po_number ILIKE $${idx}
    )`;
    values.push(`%${params.search}%`);
    idx++;
  }

  let orderBy = 'ORDER BY created_at DESC';
  if (params.sort_by && STYLE_SORTABLE_FIELDS.has(params.sort_by)) {
    const dir = params.sort_order === 'desc' ? 'DESC' : 'ASC';
    orderBy = `ORDER BY ${params.sort_by} ${dir} NULLS LAST, id ASC`;
  } else if (params.view === 'scheduling') {
    orderBy = `ORDER BY
      CASE scheduling_zone
        WHEN 'wait' THEN 0 WHEN 'group' THEN 1 WHEN 'outsource' THEN 2 WHEN 'offline' THEN 3 ELSE 4
      END,
      group_name ASC NULLS LAST,
      sort_order ASC NULLS LAST,
      online_time ASC NULLS LAST,
      id ASC`;
  } else if (params.view === 'closing') {
    orderBy = 'ORDER BY closing_month ASC NULLS LAST, style_number ASC';
  } else if (params.view === 'early_warning') {
    orderBy = 'ORDER BY required_shipping_date ASC NULLS LAST, style_number ASC';
  }

  const result = await query(`SELECT * FROM styles ${where} ${orderBy}`, values);
  const rows = result.rows.map((row) => enrichStyle(row as StyleRow));
  const parentIds = rows
    .filter((row) => row.parent_style_id == null)
    .map((row) => Number(row.id))
    .filter((id) => Number.isFinite(id));
  const allocatedMap = await loadAllocatedMap(parentIds);
  return rows.map((row) => {
    if (row.parent_style_id != null) return row;
    const childAllocated = allocatedMap.get(Number(row.id)) ?? 0;
    const allocated = effectiveAllocatedQuantity(row, childAllocated);
    return {
      ...row,
      allocated_quantity: allocated,
      unscheduled_quantity: calcUnscheduledQuantity(row.quantity, allocated),
    };
  });
}

export async function getStyleById(id: number) {
  const result = await query('SELECT * FROM styles WHERE id = $1', [id]);
  if (!result.rows[0]) return null;
  const row = enrichStyle(result.rows[0] as StyleRow);
  if (row.parent_style_id != null) return row;
  const childAllocated = await loadAllocatedMap([Number(row.id)]).then((m) => m.get(Number(row.id)) ?? 0);
  const allocated = effectiveAllocatedQuantity(row, childAllocated);
  return {
    ...row,
    allocated_quantity: allocated,
    unscheduled_quantity: calcUnscheduledQuantity(row.quantity, allocated),
  };
}

export async function createStyle(data: Record<string, unknown>) {
  const updates = pickUpdates({ scheduling_zone: 'wait', ...data });
  if (!updates.style_number) {
    throw new Error('款号必填');
  }

  const keys = Object.keys(updates);
  const values = keys.map((k) => updates[k]);
  const placeholders = keys.map((_, i) => `$${i + 1}`);

  const result = await query(
    `INSERT INTO styles (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
    values
  );
  return enrichStyle(result.rows[0] as StyleRow);
}

export async function updateStyle(
  id: number,
  data: Record<string, unknown>,
  changedBy = 'system'
) {
  const existing = await getStyleById(id);
  if (!existing) throw new Error('Style not found');

  const updates = pickUpdates(data);
  if (Object.keys(updates).length === 0) return existing;

  const diff = buildDiff(existing as Record<string, unknown>, updates);
  if (Object.keys(diff).length === 0) return existing;

  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  for (const [key, val] of Object.entries(updates)) {
    sets.push(`${key} = $${idx++}`);
    values.push(val);
  }
  sets.push('updated_at = NOW()');
  values.push(id);

  await query(`UPDATE styles SET ${sets.join(', ')} WHERE id = $${idx}`, values);
  await query(
    'INSERT INTO style_histories (style_id, changed_data, changed_by) VALUES ($1, $2, $3)',
    [id, JSON.stringify(diff), changedBy]
  );

  return getStyleById(id);
}

export async function bulkUpdateStyles(
  updates: Array<{ id: number } & Record<string, unknown>>,
  changedBy = 'system'
) {
  const client = await getClient();
  const results: StyleRow[] = [];
  try {
    await client.query('BEGIN');
    for (const item of updates) {
      const { id, ...data } = item;
      const existingResult = await client.query('SELECT * FROM styles WHERE id = $1', [id]);
      if (!existingResult.rows[0]) continue;
      const existing = existingResult.rows[0] as Record<string, unknown>;
      const patch = pickUpdates(data);
      const diff = buildDiff(existing, patch);
      if (Object.keys(diff).length === 0) {
        results.push(enrichStyle(existing as StyleRow));
        continue;
      }
      const sets: string[] = [];
      const values: unknown[] = [];
      let idx = 1;
      for (const [key, val] of Object.entries(patch)) {
        sets.push(`${key} = $${idx++}`);
        values.push(val);
      }
      sets.push('updated_at = NOW()');
      values.push(id);
      await client.query(`UPDATE styles SET ${sets.join(', ')} WHERE id = $${idx}`, values);
      await client.query(
        'INSERT INTO style_histories (style_id, changed_data, changed_by) VALUES ($1, $2, $3)',
        [id, JSON.stringify(diff), changedBy]
      );
      const updated = await client.query('SELECT * FROM styles WHERE id = $1', [id]);
      results.push(enrichStyle(updated.rows[0] as StyleRow));
    }
    await client.query('COMMIT');
    return results;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function getStyleHistory(styleId: number) {
  const result = await query(
    'SELECT * FROM style_histories WHERE style_id = $1 ORDER BY changed_at DESC',
    [styleId]
  );
  return result.rows;
}

export async function getMonthlySummary() {
  const result = await query(`
    SELECT
      closing_month,
      COUNT(*)::int AS count,
      COALESCE(SUM(
        ROUND(COALESCE(quantity, 0) * COALESCE(sales_price, 0), 2)
      ), 0)::float AS total_sales_output_value
    FROM styles
    WHERE closing_month IS NOT NULL AND closing_month <> ''
      AND parent_style_id IS NULL
    GROUP BY closing_month
    ORDER BY closing_month ASC
  `);
  return result.rows.map((row) => ({
    closing_month: row.closing_month as string,
    count: Number(row.count),
    total_sales_output_value: Number(row.total_sales_output_value),
  }));
}

export async function seedStylesIfEmpty() {
  const count = await query('SELECT COUNT(*) FROM styles');
  if (parseInt((count.rows[0] as { count: string }).count, 10) > 0) return;

  const samples = [
    {
      salesperson: '张三', brand: 'BrandA', style_number: 'ST-001', style_name: '春季夹克',
      closing_month: '2026-06', fabric_structure: '棉涤混纺', fabric_readiness: '已齐',
      accessories_readiness: '部分', sample_progress: '确认样', po_number: 'PO2026001',
      quantity: 5000, processing_unit_price: 45, sales_price: 68,
      printing_embroidery: '左胸绣花', order_follower: '李四', group_name: null, online_time: null,
    },
    {
      salesperson: '王五', brand: 'BrandB', style_number: 'ST-002', style_name: '夏季T恤',
      closing_month: '2026-07', fabric_structure: '全棉', fabric_readiness: '在途',
      accessories_readiness: '已齐', sample_progress: '产前样', po_number: 'PO2026002',
      quantity: 8000, processing_unit_price: 22, sales_price: 35,
      group_name: '2', online_time: '2026-04-01', offline_time: '2026-04-15',
      scheduled_output: 8000, avg_daily_output: 600, first_bed_time: '2026-03-28',
    },
    {
      salesperson: '赵六', brand: 'BrandA', style_number: 'ST-003', style_name: '秋冬卫衣',
      closing_month: '2026-06', fabric_structure: '抓绒', fabric_readiness: '已齐',
      accessories_readiness: '已齐', sample_progress: '大货样', po_number: 'PO2026003',
      quantity: 3000, processing_unit_price: 55, sales_price: 88,
      group_name: '外发', online_time: '2026-04-10', offline_time: '2026-04-25',
      scheduled_output: 3000, avg_daily_output: 200, is_outsourced: true,
      outsourced_factory: '外协厂X', outsourced_price: 50,
    },
    {
      salesperson: '张三', brand: 'BrandC', style_number: 'ST-004', style_name: '休闲裤',
      closing_month: '2026-08', fabric_structure: '弹力斜纹', fabric_readiness: '未齐',
      accessories_readiness: '未齐', sample_progress: '开发样', po_number: 'PO2026004',
      quantity: 6000, processing_unit_price: 38, sales_price: 58,
      group_name: '1', online_time: '2026-05-01', offline_time: '2026-05-20',
      scheduled_output: 6000, avg_daily_output: 350,
    },
  ];

  for (const s of samples) {
    await query(
      `INSERT INTO styles (
        salesperson, brand, style_number, style_name, closing_month,
        fabric_structure, fabric_readiness, accessories_readiness, sample_progress,
        po_number, quantity, processing_unit_price, sales_price,
        printing_embroidery, order_follower, group_name, online_time, offline_time,
        scheduled_output, avg_daily_output, first_bed_time, is_outsourced,
        outsourced_factory, outsourced_price
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
      [
        s.salesperson, s.brand, s.style_number, s.style_name, s.closing_month,
        s.fabric_structure, s.fabric_readiness, s.accessories_readiness, s.sample_progress,
        s.po_number, s.quantity, s.processing_unit_price, s.sales_price,
        s.printing_embroidery, s.order_follower ?? null, s.group_name ?? null,
        s.online_time ?? null, s.offline_time ?? null, s.scheduled_output ?? null,
        s.avg_daily_output ?? null, s.first_bed_time ?? null, s.is_outsourced ?? false,
        s.outsourced_factory ?? null, s.outsourced_price ?? null,
      ]
    );
  }
}
