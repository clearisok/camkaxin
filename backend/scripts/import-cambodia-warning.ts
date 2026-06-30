/**
 * 导入柬埔寨生产预警 Excel 到 styles 表
 * 用法: npx tsx scripts/import-cambodia-warning.ts [xlsx路径] [--dry-run]
 */
import ExcelJS from 'exceljs';
import dotenv from 'dotenv';
import { pool, query } from '../src/config/database.js';
import { createStyle, updateStyle } from '../src/services/styleService.js';
import { toYmdBeijing } from '../src/utils/beijingTime.js';

dotenv.config();

const DEFAULT_FILE = String.raw`c:\Users\Administrator\Desktop\temp\2026柬埔寨生产预警报表(6.5)(2).xlsx`;

const SKIP_SHEETS = new Set(['Sheet1', 'Sheet2', 'Sheet3']);

const HEADER_ALIASES: Record<string, string> = {
  业务员: 'salesperson',
  品牌: 'brand',
  款号: 'style_number',
  款式名称: 'style_name',
  面料结构: 'fabric_structure',
  面料进度: 'fabric_readiness',
  辅料进度: 'accessories_readiness',
  样衣进度: 'sample_progress',
  数量: 'quantity',
  单价: 'sales_price',
  销售单价: 'sales_price',
  加工单价: 'processing_unit_price',
  产值: '_output_value',
  印绣花: 'printing_embroidery',
  理单员: 'order_follower',
  跟单员: 'order_follower',
  出运日期: 'required_shipping_date',
  要求出货日: 'required_shipping_date',
  关账月份: 'closing_month',
  组别: 'group_name',
  上线时间: 'online_time',
  下线时间: 'offline_time',
  备注: 'remarks',
  PO号: 'po_number',
  PO: 'po_number',
};

type RowRecord = Record<string, unknown>;

const MAX_FIELD_LENGTH: Record<string, number> = {
  salesperson: 100,
  brand: 200,
  style_number: 100,
  style_name: 200,
  fabric_structure: 200,
  fabric_readiness: 100,
  accessories_readiness: 100,
  sample_progress: 100,
  printing_embroidery: 200,
  order_follower: 100,
  group_name: 100,
  po_number: 100,
  outsourced_factory: 200,
  overseas_merchandiser: 100,
};

function truncateFields(rec: RowRecord): void {
  for (const [key, max] of Object.entries(MAX_FIELD_LENGTH)) {
    if (typeof rec[key] === 'string' && (rec[key] as string).length > max) {
      rec[key] = (rec[key] as string).slice(0, max);
    }
  }
}

function parseClosingMonth(sheetName: string): string | null {
  const m1 = sheetName.match(/^(\d{1,2})月份$/);
  if (m1) return `2026-${m1[1].padStart(2, '0')}`;

  const m2 = sheetName.match(/^2026\.(\d{2})$/);
  if (m2) return `2026-${m2[1]}`;

  const m3 = sheetName.match(/^2026-(\d{2})$/);
  if (m3) return `2026-${m3[1]}`;

  return null;
}

function shouldImportSheet(name: string): boolean {
  if (SKIP_SHEETS.has(name)) return false;
  if (parseClosingMonth(name)) return true;
  return ['十八子', 'GG', '新金友'].includes(name);
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (value instanceof Date) return toYmdBeijing(value) ?? '';
  if (typeof value === 'object') {
    if ('result' in value && value.result != null) return cellText(value.result as ExcelJS.CellValue);
    if ('text' in value && value.text) return String(value.text).trim();
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((t) => t.text).join('').trim();
    }
    return '';
  }
  return String(value).trim();
}

function isValidYear(year: number): boolean {
  return year >= 2000 && year <= 2035;
}

function formatYmd(year: number, month: number, day: number): string | null {
  if (!isValidYear(year) || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function excelSerialToDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 20000 || serial > 60000) return null;
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
  const d = new Date(utc);
  return formatYmd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

function parseDate(value: ExcelJS.CellValue): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return excelSerialToDate(value);
  if (value instanceof Date) {
    return toYmdBeijing(value);
  }
  const text = cellText(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const y = Number(text.slice(0, 4));
    return isValidYear(y) ? text.slice(0, 10) : null;
  }
  const m = text.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})/);
  if (m) return formatYmd(Number(m[1]), Number(m[2]), Number(m[3]));
  const d = new Date(text);
  if (!Number.isNaN(d.getTime())) {
    return toYmdBeijing(d);
  }
  return null;
}

function parseNumber(value: ExcelJS.CellValue): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = cellText(value).replace(/,/g, '');
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function normalizeGroupName(raw: string): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (v === '外发') return '外发';
  const m = v.match(/^(\d{1,2})组?$/);
  if (m) return m[1];
  if (/^[1-9]$|^1[0-3]$|^15$|^16$/.test(v)) return v;
  return v;
}

function findHeaderRow(ws: ExcelJS.Worksheet): { rowIndex: number; map: Map<number, string> } | null {
  for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
    const map = new Map<number, string>();
    const row = ws.getRow(r);
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const label = cellText(cell.value);
      const field = HEADER_ALIASES[label];
      if (field) map.set(col, field);
    });
    if (map.size >= 3 && [...map.values()].includes('style_number')) {
      return { rowIndex: r, map };
    }
  }
  return null;
}

function rowToRecord(
  ws: ExcelJS.Worksheet,
  rowIndex: number,
  colMap: Map<number, string>,
  closingMonth: string | null,
  sheetName: string,
): RowRecord | null {
  const row = ws.getRow(rowIndex);
  const rec: RowRecord = {};

  colMap.forEach((field, col) => {
    const cell = row.getCell(col);
    const val = cell.value;
    if (field === '_output_value') return;
    if (['required_shipping_date', 'online_time', 'offline_time', 'first_bed_time'].includes(field)) {
      const d = parseDate(val);
      if (d) rec[field] = d;
      return;
    }
    if (['quantity', 'sales_price', 'processing_unit_price', 'scheduled_output', 'avg_daily_output', 'outsourced_price'].includes(field)) {
      const n = parseNumber(val);
      if (n != null) rec[field] = n;
      return;
    }
    const text = cellText(val);
    if (text) rec[field] = text;
  });

  const styleNumber = String(rec.style_number ?? '').trim();
  if (!styleNumber) return null;

  if (!rec.closing_month && closingMonth) rec.closing_month = closingMonth;

  if (rec.group_name) rec.group_name = normalizeGroupName(String(rec.group_name));

  if (rec.group_name === '外发') rec.is_outsourced = true;

  if (!rec.style_name) {
    rec.style_name = styleNumber;
  }

  if (['十八子', 'GG', '新金友'].includes(sheetName) && !rec.remarks) {
    rec.remarks = `来源表：${sheetName}`;
  } else if (['十八子', 'GG', '新金友'].includes(sheetName)) {
    rec.remarks = `${rec.remarks}（来源表：${sheetName}）`;
  }

  truncateFields(rec);
  return rec;
}

async function findExistingId(styleNumber: string, closingMonth?: string | null): Promise<number | null> {
  if (closingMonth) {
    const res = await query<{ id: number }>(
      'SELECT id FROM styles WHERE style_number = $1 AND closing_month = $2 LIMIT 1',
      [styleNumber, closingMonth],
    );
    if (res.rows[0]) return res.rows[0].id;
  }
  const res = await query<{ id: number }>(
    'SELECT id FROM styles WHERE style_number = $1 ORDER BY id LIMIT 1',
    [styleNumber],
  );
  return res.rows[0]?.id ?? null;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const file = args.find((a) => !a.startsWith('--')) || DEFAULT_FILE;

  console.log(`读取文件: ${file}`);
  console.log(dryRun ? '【试运行，不写入数据库】' : '【正式导入】');

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const ws of wb.worksheets) {
    if (!shouldImportSheet(ws.name)) {
      console.log(`跳过工作表: ${ws.name}`);
      continue;
    }

    const header = findHeaderRow(ws);
    if (!header) {
      console.log(`跳过（未找到表头）: ${ws.name}`);
      continue;
    }

    const closingMonth = parseClosingMonth(ws.name);
    console.log(`处理: ${ws.name}（关账月份: ${closingMonth ?? '未指定'}，数据从第 ${header.rowIndex + 1} 行起）`);

    for (let r = header.rowIndex + 1; r <= ws.rowCount; r++) {
      try {
        const rec = rowToRecord(ws, r, header.map, closingMonth, ws.name);
        if (!rec) {
          skipped++;
          continue;
        }

        const styleNumber = String(rec.style_number);
        if (dryRun) {
          console.log(`  [dry] ${styleNumber} | ${rec.brand ?? ''} | ${rec.closing_month ?? ''}`);
          inserted++;
          continue;
        }

        const existingId = await findExistingId(styleNumber, rec.closing_month as string | null);
        if (existingId) {
          await updateStyle(existingId, rec, 'excel-import');
          updated++;
        } else {
          await createStyle(rec);
          inserted++;
        }
      } catch (err) {
        errors.push(`${ws.name} 行${r}: ${String(err)}`);
      }
    }
  }

  console.log('\n导入完成');
  console.log(`新增: ${inserted}`);
  console.log(`更新: ${updated}`);
  console.log(`跳过空行: ${skipped}`);
  if (errors.length) {
    console.log(`失败: ${errors.length}`);
    errors.slice(0, 20).forEach((e) => console.log('  ', e));
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
