import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

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
  valid_until?: string;
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
  有效期至: (q) => q.valid_until || '',
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
  AccessoryTable: ['name', 'consumption', 'wastage', 'unit_price', 'amount'],
  QuantityTierTable: ['min_qty', 'max_qty', 'price'],
};

function replacePlaceholders(
  worksheet: ExcelJS.Worksheet,
  quotation: ExportQuotation,
  item?: ExportItem
) {
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (typeof cell.value === 'string') {
        let value = cell.value as string;
        const matches = value.match(/\$\{([^}]+)\}/g);
        if (matches) {
          for (const match of matches) {
            const key = match.slice(2, -1);
            const resolver = PLACEHOLDER_MAP[key];
            if (resolver) {
              value = value.replace(match, resolver(quotation, item));
            }
          }
          cell.value = value;
        }
      }
    });
  });
}

async function fillNamedTable(
  worksheet: ExcelJS.Worksheet,
  tableName: string,
  rows: Array<Record<string, unknown>>
) {
  const columns = TABLE_COLUMNS[tableName];
  if (!columns) return;

  const tables = (worksheet as unknown as { tables?: Record<string, { ref: string }> }).tables;
  if (!tables || !tables[tableName]) {
    // 查找包含表名的单元格作为起始点
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
        cell.value = data[col] != null ? String(data[col]) : '';
      });
    });
    return;
  }

  const tableRef = tables[tableName].ref;
  const match = tableRef.match(/([A-Z]+)(\d+)/);
  if (!match) return;

  const startRow = parseInt(match[2], 10) + 1;
  const startCol = match[1].charCodeAt(0) - 64;

  rows.forEach((data, index) => {
    const rowNum = startRow + index;
    columns.forEach((col, colIndex) => {
      const cell = worksheet.getCell(rowNum, startCol + colIndex);
      cell.value = data[col] != null ? String(data[col]) : '';
    });
  });
}

async function embedImage(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  imagePath: string,
  placeholder: string
) {
  if (!imagePath || !fs.existsSync(imagePath)) return;

  let targetRow = 1;
  let targetCol = 1;
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      if (typeof cell.value === 'string' && cell.value.includes(placeholder)) {
        targetRow = rowNumber;
        targetCol = colNumber;
        cell.value = '';
      }
    });
  });

  const imageId = workbook.addImage({
    filename: imagePath,
    extension: path.extname(imagePath).slice(1) as 'png' | 'jpeg' | 'gif',
  });

  worksheet.addImage(imageId, {
    tl: { col: targetCol - 1, row: targetRow - 1 },
    ext: { width: 120, height: 120 },
  });
}

export async function exportQuotationToExcel(
  templatePath: string,
  quotation: ExportQuotation,
  options: { splitByItem?: boolean } = {}
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);

  const items = quotation.items || [{} as ExportItem];

  if (options.splitByItem && items.length > 1) {
    const templateSheet = workbook.worksheets[0];
    if (!templateSheet) throw new Error('Template has no worksheets');

    // 克隆模板 sheet 数据后再移除原 sheet
    const templateRows: Array<{ rowNum: number; cells: Array<{ col: number; value: unknown; style?: ExcelJS.Style }> }> = [];
    templateSheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const cells: Array<{ col: number; value: unknown; style?: ExcelJS.Style }> = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cells.push({ col: colNumber, value: cell.value as ExcelJS.CellValue, style: cell.style ? JSON.parse(JSON.stringify(cell.style)) as ExcelJS.Style : undefined });
      });
      templateRows.push({ rowNum: rowNumber, cells });
    });

    workbook.removeWorksheet(templateSheet.id);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const sheetName = (item.version_label || item.product_code || `明细行${i + 1}`).slice(0, 31);
      const newSheet = workbook.addWorksheet(sheetName);

      for (const { rowNum, cells } of templateRows) {
        const newRow = newSheet.getRow(rowNum);
        for (const { col, value, style } of cells) {
          const newCell = newRow.getCell(col);
          newCell.value = value as ExcelJS.CellValue;
          if (style) newCell.style = style as ExcelJS.Style;
        }
        newRow.commit();
      }

      replacePlaceholders(newSheet, quotation, item);
      await fillNamedTable(newSheet, 'FabricTable', item.fabrics || []);
      await fillNamedTable(newSheet, 'AccessoryTable', item.accessories || []);
      await fillNamedTable(newSheet, 'QuantityTierTable', item.quantity_tiers || []);

      if (item.style_image) {
        await embedImage(workbook, newSheet, item.style_image, '${款式图}');
      }
    }
  } else {
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error('Template has no worksheets');

    const item = items[0];
    replacePlaceholders(sheet, quotation, item);
    await fillNamedTable(sheet, 'FabricTable', item?.fabrics || []);
    await fillNamedTable(sheet, 'AccessoryTable', item?.accessories || []);
    await fillNamedTable(sheet, 'QuantityTierTable', item?.quantity_tiers || []);

    if (item?.style_image) {
      await embedImage(workbook, sheet, item.style_image, '${款式图}');
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
