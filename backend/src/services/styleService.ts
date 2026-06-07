import { query, getClient } from '../config/database.js';
import {
  EDITABLE_STYLE_FIELDS,
  enrichStyle,
  type StyleRow,
} from '../utils/styleCalculations.js';

export interface StyleListQuery {
  view?: 'early_warning' | 'scheduling' | 'closing';
  closing_month?: string;
  group?: string;
  unscheduled_only?: boolean;
  search?: string;
}

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
  return value;
}

function pickUpdates(data: Record<string, unknown>): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  for (const key of EDITABLE_STYLE_FIELDS) {
    if (key in data) updates[key] = normalizeValue(key, data[key]);
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

export async function listStyles(params: StyleListQuery) {
  let where = 'WHERE 1=1';
  const values: unknown[] = [];
  let idx = 1;

  if (params.view === 'scheduling') {
    where += ' AND group_name IS NOT NULL AND group_name <> \'\'';
  }
  if (params.closing_month) {
    where += ` AND closing_month = $${idx++}`;
    values.push(params.closing_month);
  }
  if (params.group) {
    where += ` AND group_name = $${idx++}`;
    values.push(params.group);
  }
  if (params.unscheduled_only) {
    where += ' AND (group_name IS NULL OR group_name = \'\' OR online_time IS NULL)';
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
  if (params.view === 'scheduling') {
    orderBy = 'ORDER BY group_name ASC, online_time ASC NULLS LAST, offline_time ASC NULLS LAST';
  } else if (params.view === 'closing') {
    orderBy = 'ORDER BY closing_month ASC NULLS LAST, style_number ASC';
  }

  const result = await query(`SELECT * FROM styles ${where} ${orderBy}`, values);
  return result.rows.map((row) => enrichStyle(row as StyleRow));
}

export async function getStyleById(id: number) {
  const result = await query('SELECT * FROM styles WHERE id = $1', [id]);
  if (!result.rows[0]) return null;
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
      group_name: 'A组', online_time: '2026-04-01', offline_time: '2026-04-15',
      scheduled_output: 8000, avg_daily_output: 600, first_bed_time: '2026-03-28',
    },
    {
      salesperson: '赵六', brand: 'BrandA', style_number: 'ST-003', style_name: '秋冬卫衣',
      closing_month: '2026-06', fabric_structure: '抓绒', fabric_readiness: '已齐',
      accessories_readiness: '已齐', sample_progress: '大货样', po_number: 'PO2026003',
      quantity: 3000, processing_unit_price: 55, sales_price: 88,
      group_name: 'B组', online_time: '2026-04-10', offline_time: '2026-04-25',
      scheduled_output: 3000, avg_daily_output: 200, is_outsourced: true,
      outsourced_factory: '外协厂X', outsourced_price: 50,
    },
    {
      salesperson: '张三', brand: 'BrandC', style_number: 'ST-004', style_name: '休闲裤',
      closing_month: '2026-08', fabric_structure: '弹力斜纹', fabric_readiness: '未齐',
      accessories_readiness: '未齐', sample_progress: '开发样', po_number: 'PO2026004',
      quantity: 6000, processing_unit_price: 38, sales_price: 58,
      group_name: 'A组', online_time: '2026-05-01', offline_time: '2026-05-20',
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
