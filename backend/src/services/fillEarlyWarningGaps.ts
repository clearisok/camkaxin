import { query } from '../config/database.js';
import { updateStyle } from './styleService.js';
import { EDITABLE_STYLE_FIELDS } from '../utils/styleCalculations.js';

const CLOSING_MONTHS = [
  '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
  '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12',
];

const FABRIC_STRUCTURES = ['全棉斜纹', '涤棉混纺', '针织汗布', '牛仔布', '雪纺', '弹力斜纹', '抓绒'];
const READINESS = ['未到', '在途', '已到', '齐套', '待确认'];
const SAMPLE_PROGRESS = ['开发样', '确认样', '产前样', '大货样', '待确认'];
const PRINTING = ['无', '左胸绣花', '后背印花', '袖口绣花', '满印'];
const FOLLOWERS = ['张三', '李四', '王五', '赵六', '陈七', '刘八'];
const STYLE_NAMES = ['春季夹克', '夏季T恤', '秋冬卫衣', '休闲裤', '连衣裙', '风衣', '衬衫', '短裤'];

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function randomInt(min: number, max: number, seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  const r = x - Math.floor(x);
  return Math.floor(r * (max - min + 1)) + min;
}

function randomDate(seed: number): string {
  const month = randomInt(4, 11, seed);
  const day = randomInt(1, 28, seed + 1);
  return `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function randomPrice(min: number, max: number, seed: number): number {
  const cents = randomInt(min * 100, max * 100, seed);
  return Math.round(cents) / 100;
}

export async function fillEarlyWarningGaps(changedBy = 'fill-early-warning-gaps') {
  const brandsRes = await query<{ name: string }>('SELECT name FROM brands ORDER BY name');
  const brands = brandsRes.rows.map((r) => r.name);
  if (brands.length === 0) brands.push('ZARA', 'H&M', 'UNIQLO');

  const agentsRes = await query<{ name: string; brand_name: string }>(
    `SELECT a.name, b.name AS brand_name
     FROM agents a
     JOIN brands b ON b.id = a.brand_id
     ORDER BY b.name, a.name`,
  );
  const agentsByBrand = new Map<string, string[]>();
  for (const row of agentsRes.rows) {
    const list = agentsByBrand.get(row.brand_name) || [];
    list.push(row.name);
    agentsByBrand.set(row.brand_name, list);
  }

  const stylesRes = await query<Record<string, unknown>>('SELECT * FROM styles ORDER BY id');

  let updated = 0;
  let fieldsFilled = 0;

  for (const row of stylesRes.rows) {
    const id = Number(row.id);
    const patch: Record<string, unknown> = {};
    const seed = id * 97;

    const fillText = (key: string, value: string) => {
      if (EDITABLE_STYLE_FIELDS.includes(key as typeof EDITABLE_STYLE_FIELDS[number]) && isEmpty(row[key])) {
        patch[key] = value;
      }
    };

    const brand = isEmpty(row.brand) ? pick(brands, seed) : String(row.brand);
    if (isEmpty(row.brand)) patch.brand = brand;

    const agents = agentsByBrand.get(brand) || FOLLOWERS;
    fillText('salesperson', pick(agents, seed + 1));
    fillText('style_name', `${pick(STYLE_NAMES, seed + 2)}-${String(id).padStart(3, '0')}`);
    fillText('po_number', `PO2026${String(id).padStart(4, '0')}`);
    fillText('fabric_structure', pick(FABRIC_STRUCTURES, seed + 3));
    fillText('fabric_readiness', pick(READINESS, seed + 4));
    fillText('accessories_readiness', pick(READINESS, seed + 5));
    fillText('sample_progress', pick(SAMPLE_PROGRESS, seed + 6));
    fillText('printing_embroidery', pick(PRINTING, seed + 7));
    fillText('order_follower', pick(FOLLOWERS, seed + 8));
    fillText('remarks', '系统随机补全');
    fillText('closing_month', pick(CLOSING_MONTHS, seed + 9));

    if (isEmpty(row.required_shipping_date)) {
      patch.required_shipping_date = randomDate(seed + 10);
    }
    if (row.quantity == null || row.quantity === '') {
      patch.quantity = randomInt(2000, 12000, seed + 11);
    }
    if (row.processing_unit_price == null || row.processing_unit_price === '') {
      patch.processing_unit_price = randomPrice(18, 65, seed + 12);
    }
    if (row.sales_price == null || row.sales_price === '') {
      patch.sales_price = randomPrice(28, 98, seed + 13);
    }
    if (isEmpty(row.scheduling_zone)) {
      patch.scheduling_zone = 'wait';
    }

    if (Object.keys(patch).length === 0) continue;

    fieldsFilled += Object.keys(patch).length;
    await updateStyle(id, patch, changedBy);
    updated++;
  }

  return { updated, fieldsFilled };
}
