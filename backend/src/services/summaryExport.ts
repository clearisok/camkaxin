import ExcelJS from 'exceljs';
import { getQuotationFull } from './quotationService.js';
import { loadImageBuffer, IMAGE_SIZE } from './excelExport.js';

export interface SummaryRow {
  brand_name: string;
  product_code: string;
  style_image?: string;
  fabric_info: string;
  quantity: number;
  description: string;
  labor_cost_usd: number;
  labor_rmb: number;
  final_price: number;
  currency: string;
}

function formatFabricInfo(fabrics: Array<Record<string, unknown>>): string {
  if (!fabrics?.length) return '';
  return fabrics
    .map((f) => {
      const name = f.name || '未知面料';
      const consumption = f.consumption ?? f.piece_length ?? '';
      return `${name}×${consumption}`;
    })
    .join('；');
}

export async function buildSummaryRows(quotationIds: number[]): Promise<SummaryRow[]> {
  const rows: SummaryRow[] = [];

  for (const id of quotationIds) {
    const q = await getQuotationFull(id);
    if (!q) continue;

    const quotation = q as Record<string, unknown>;
    const brandName = (quotation.brand_name as string) || '';
    const currency = (quotation.currency as string) || 'RMB';
    const items = (quotation.items as Array<Record<string, unknown>>) || [];

    for (const item of items) {
      rows.push({
        brand_name: brandName,
        product_code: (item.product_code as string) || '',
        style_image: item.style_image as string | undefined,
        fabric_info: formatFabricInfo((item.fabrics as Array<Record<string, unknown>>) || []),
        quantity: Number(item.quantity) || 0,
        description: (item.description as string) || '',
        labor_cost_usd: Number(item.labor_cost_usd) || 0,
        labor_rmb: Number(item.labor_rmb) || 0,
        final_price: Number(item.final_price) || 0,
        currency,
      });
    }
  }

  return rows;
}

export async function exportSummaryExcel(quotationIds: number[]): Promise<Buffer> {
  const rows = await buildSummaryRows(quotationIds);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('报价汇总');

  const headers = ['品牌', '款号', '款式图', '面料信息', '数量', '报价说明', '工价(USD)', '工价(RMB)', '总价'];
  sheet.addRow(headers);

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 28;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;
    sheet.addRow([
      r.brand_name,
      r.product_code,
      '',
      r.fabric_info,
      r.quantity,
      r.description,
      r.labor_cost_usd,
      r.labor_rmb,
      r.final_price,
    ]);

    sheet.getRow(rowNum).height = IMAGE_SIZE * 0.75;
    sheet.getRow(rowNum).alignment = { vertical: 'middle', wrapText: true };

    if (r.style_image) {
      const img = await loadImageBuffer(r.style_image, 80);
      if (img) {
        const imageId = workbook.addImage({ buffer: img.buffer as never, extension: img.extension });
        sheet.addImage(imageId, {
          tl: { col: 2, row: rowNum - 1 },
          ext: { width: 80, height: 80 },
          editAs: 'oneCell',
        });
      }
    }
  }

  sheet.columns.forEach((col, idx) => {
    let maxLen = headers[idx]?.length || 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value || '').length;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(Math.max(maxLen + 2, 12), idx === 2 ? 14 : idx === 3 ? 40 : 20);
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function buildSummaryFilename(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `报价汇总_${date}.xlsx`;
}
