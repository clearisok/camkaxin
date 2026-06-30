import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { todayYmdCompactBeijing } from '../utils/beijingTime.js';

const IMAGE_SIZE = 150;

interface ExportItem {
  product_code?: string;
  version_label?: string;
  style_image?: string;
  delivery_date?: string;
  quantity?: number;
  description?: string;
  labor_cost_usd?: number;
  other_cost_rmb?: number;
  shipping_rmb?: number;
  fabric_total?: number;
  accessory_total?: number;
  labor_rmb?: number;
  subtotal_rmb?: number;
  final_price?: number;
  fabrics?: Array<Record<string, unknown>>;
  accessories?: Array<Record<string, unknown>>;
  quantity_tiers?: Array<Record<string, unknown>>;
}

interface ExportQuotation {
  quotation_no?: string;
  agent_name?: string;
  currency?: string;
  exchange_rate?: number;
  quote_date?: string;
  fabric_delivery_date?: string;
  garment_delivery_date?: string;
  target_labor_price?: number;
  target_garment_price?: number;
  confirmed_labor_price?: number;
  confirmed_garment_price?: number;
  profit_margin?: number;
  remarks?: string;
  brand_name?: string;
  items?: ExportItem[];
}

const PLACEHOLDER_MAP: Record<string, (q: ExportQuotation, item?: ExportItem) => string> = {
  报价单号: (q) => q.quotation_no || '',
  品牌: (q) => q.brand_name || '',
  业务员: (q) => q.agent_name || '',
  报价币种: (q) => q.currency || '',
  汇率: (q) => String(q.exchange_rate || ''),
  报价日期: (q) => q.quote_date || '',
  面料交期: (q) => q.fabric_delivery_date || '',
  成衣交期: (q) => q.garment_delivery_date || '',
  目标工价: (q) => (q.target_labor_price != null ? String(q.target_labor_price) : ''),
  目标成衣价格: (q) => (q.target_garment_price != null ? String(q.target_garment_price) : ''),
  确认工价: (q) => (q.confirmed_labor_price != null ? String(q.confirmed_labor_price) : ''),
  确认成衣价格: (q) => (q.confirmed_garment_price != null ? String(q.confirmed_garment_price) : ''),
  有效期至: (q) => q.garment_delivery_date || '',
  利润率: (q) => `${q.profit_margin || 0}%`,
  备注: (q) => q.remarks || '',
  款号: (_q, item) => item?.product_code || '',
  版本标签: (_q, item) => item?.version_label || '',
  交期: (_q, item) => item?.delivery_date || '',
  数量: (_q, item) => String(item?.quantity || ''),
  描述: (_q, item) => item?.description || '',
  '工价USD': (_q, item) => String(item?.labor_cost_usd || ''),
  其他费用: (_q, item) => String(item?.other_cost_rmb || ''),
  运费: (_q, item) => String(item?.shipping_rmb || ''),
  面料总成本: (_q, item) => String(item?.fabric_total || ''),
  辅料总成本: (_q, item) => String(item?.accessory_total || ''),
  工价RMB: (_q, item) => String(item?.labor_rmb || ''),
  成本小计: (_q, item) => String(item?.subtotal_rmb || ''),
  最终报价: (_q, item) => String(item?.final_price || ''),
};

const TABLE_COLUMNS: Record<string, string[]> = {
  FabricTable: ['name', 'composition', 'weight', 'net_width', 'gross_width', 'unit', 'piece_length', 'wastage', 'consumption', 'unit_price', 'amount'],
  AccessoryTable: ['name', 'specification', 'consumption', 'wastage', 'unit_price', 'amount'],
  QuantityTierTable: ['min_qty', 'max_qty', 'price'],
};

/** 单元格是否含公式 */
function cellHasFormula(cell: ExcelJS.Cell): boolean {
  const v = cell.value;
  if (v && typeof v === 'object' && 'formula' in v && (v as { formula?: string }).formula) {
    return true;
  }
  if (cell.formula) return true;
  return false;
}

function resolveImagePath(imagePath: string): string | null {
  if (!imagePath) return null;
  const candidates = [
    imagePath,
    path.join(process.cwd(), imagePath),
    path.join(process.cwd(), imagePath.replace(/^\//, '')),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** 裁切为固定尺寸（保持比例，居中裁剪） */
async function loadImageBuffer(imagePath: string, size = IMAGE_SIZE): Promise<{ buffer: Uint8Array; extension: 'png' | 'jpeg' | 'gif' } | null> {
  const resolved = resolveImagePath(imagePath);
  if (!resolved) return null;

  const ext = path.extname(resolved).toLowerCase();
  let extension: 'png' | 'jpeg' | 'gif' = 'jpeg';
  if (ext === '.png') extension = 'png';
  else if (ext === '.gif') extension = 'gif';

  const raw = await sharp(resolved)
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 90 })
    .toBuffer();

  return { buffer: new Uint8Array(raw), extension: 'jpeg' };
}

function replacePlaceholders(
  worksheet: ExcelJS.Worksheet,
  quotation: ExportQuotation,
  item?: ExportItem
) {
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (cellHasFormula(cell)) return;

      if (typeof cell.value === 'string') {
        let value = cell.value as string;
        const matches = value.match(/\$\{([^}]+)\}/g);
        if (!matches) return;

        for (const match of matches) {
          const key = match.slice(2, -1);
          if (key === '款式图') continue;
          const resolver = PLACEHOLDER_MAP[key];
          if (resolver) {
            value = value.replace(match, resolver(quotation, item));
          }
        }
        if (value !== cell.value) {
          cell.value = value;
        }
      }
    });
  });
}

function fillNamedTable(
  worksheet: ExcelJS.Worksheet,
  tableName: string,
  rows: Array<Record<string, unknown>>
) {
  const columns = TABLE_COLUMNS[tableName];
  if (!columns) return;

  let startRow = -1;
  let startCol = -1;
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      if (typeof cell.value === 'string' && cell.value.includes(`{{${tableName}}}`)) {
        startRow = rowNumber;
        startCol = colNumber;
        cell.value = '';
      }
    });
  });

  if (startRow === -1) return;

  rows.forEach((data, index) => {
    const rowNum = startRow + index;
    columns.forEach((col, colIndex) => {
      const cell = worksheet.getCell(rowNum, startCol + colIndex);
      if (cellHasFormula(cell)) return;
      cell.value = data[col] != null ? String(data[col]) : '';
    });
  });
}

async function embedImage(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  imagePath: string,
  placeholder = '${款式图}'
) {
  const img = await loadImageBuffer(imagePath);
  if (!img) return;

  let targetRow = 1;
  let targetCol = 1;
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      const val = cell.value;
      if (typeof val === 'string' && val.includes(placeholder)) {
        targetRow = rowNumber;
        targetCol = colNumber;
        cell.value = '';
      }
    });
  });

  const imageId = workbook.addImage({
    // exceljs Buffer type differs from Node @types; runtime accepts Uint8Array
    buffer: img.buffer as never,
    extension: img.extension,
  });

  worksheet.addImage(imageId, {
    tl: { col: targetCol - 1, row: targetRow - 1 },
    ext: { width: IMAGE_SIZE, height: IMAGE_SIZE },
    editAs: 'oneCell',
  });

  worksheet.getRow(targetRow).height = Math.max(worksheet.getRow(targetRow).height || 0, IMAGE_SIZE * 0.75);
  worksheet.getColumn(targetCol).width = Math.max(worksheet.getColumn(targetCol).width || 0, IMAGE_SIZE / 7);
}

async function processSheet(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  quotation: ExportQuotation,
  item?: ExportItem
) {
  replacePlaceholders(sheet, quotation, item);
  fillNamedTable(sheet, 'FabricTable', item?.fabrics || []);
  fillNamedTable(sheet, 'AccessoryTable', item?.accessories || []);
  fillNamedTable(sheet, 'QuantityTierTable', item?.quantity_tiers || []);

  if (item?.style_image) {
    await embedImage(workbook, sheet, item.style_image);
  }
}

type SheetSnapshot = Array<{ rowNum: number; cells: Array<{ col: number; value: ExcelJS.CellValue; style?: ExcelJS.Style }> }>;

function snapshotSheet(sheet: ExcelJS.Worksheet): SheetSnapshot {
  const rows: SheetSnapshot = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: SheetSnapshot[0]['cells'] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cells.push({
        col: colNumber,
        value: cell.value as ExcelJS.CellValue,
        style: cell.style ? (JSON.parse(JSON.stringify(cell.style)) as ExcelJS.Style) : undefined,
      });
    });
    rows.push({ rowNum: rowNumber, cells });
  });
  return rows;
}

function restoreSheet(sheet: ExcelJS.Worksheet, snapshot: SheetSnapshot) {
  for (const { rowNum, cells } of snapshot) {
    const newRow = sheet.getRow(rowNum);
    for (const { col, value, style } of cells) {
      const newCell = newRow.getCell(col);
      newCell.value = value;
      if (style) newCell.style = style;
    }
    newRow.commit();
  }
}

export async function exportQuotationToExcel(
  templatePath: string,
  quotation: ExportQuotation,
  options: { splitByItem?: boolean } = {}
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);

  const items = quotation.items?.length ? quotation.items : [{} as ExportItem];

  if (options.splitByItem && items.length > 1) {
    const templateSheet = workbook.worksheets[0];
    if (!templateSheet) throw new Error('Template has no worksheets');

    const snapshot = snapshotSheet(templateSheet);
    workbook.removeWorksheet(templateSheet.id);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const sheetName = (item.version_label || item.product_code || `明细行${i + 1}`).slice(0, 31);
      const newSheet = workbook.addWorksheet(sheetName);
      restoreSheet(newSheet, snapshot);
      await processSheet(workbook, newSheet, quotation, item);
    }
  } else {
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error('Template has no worksheets');
    await processSheet(workbook, sheet, quotation, items[0]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** 生成标价表默认文件名：品牌_款号_日期 */
export function buildQuotationExportFilename(
  quotation: ExportQuotation,
  customFilename?: string
): string {
  if (customFilename) {
    return customFilename.endsWith('.xlsx') ? customFilename : `${customFilename}.xlsx`;
  }
  const brand = (quotation.brand_name || '未知品牌').replace(/[/\\?*[\]:]/g, '_');
  const items = quotation.items || [];
  const codes = items.map((i) => i.product_code).filter(Boolean) as string[];
  let codePart = codes[0] || '无款号';
  if (codes.length > 1) codePart = `${codePart}等`;
  const date = todayYmdCompactBeijing();
  return `${brand}_${codePart}_${date}.xlsx`;
}

export { loadImageBuffer, IMAGE_SIZE };
