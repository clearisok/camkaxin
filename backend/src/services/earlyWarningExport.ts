import ExcelJS from 'exceljs';
import { query } from '../config/database.js';
import { enrichStyle, type StyleRow } from '../utils/styleCalculations.js';
import { toYmdBeijing, todayYmdCompactBeijing } from '../utils/beijingTime.js';
import { loadImageBuffer } from './excelExport.js';
import {
  type ExportTemplateConfig,
  getColumnTitle,
  getColumnWidth,
} from './exportTemplateService.js';
/** 数据行固定行高（磅） */
export const EARLY_WARNING_EXPORT_ROW_HEIGHT = 20;
/** 嵌入图片像素尺寸（适配 20 磅行高） */
const IMAGE_PIXEL_SIZE = 18;

const STYLE_DATE_FIELDS = new Set([
  'required_shipping_date', 'first_bed_time', 'online_time', 'offline_time',
]);

const EXPORT_EXCLUDED = new Set(['action', 'row_edit']);
export interface EarlyWarningExportMeta {
  export_user?: string;
  export_time?: string;
  template_name?: string;
  search_scope?: 'local' | 'global' | 'accumulate';
  search_keyword?: string;
  closing_month_start?: string;
  closing_month_end?: string;
  field_filter_field?: string;
  field_filter_label?: string;
  field_filter_values?: string[];
  unscheduled_only?: boolean;
  export_mode?: 'selected' | 'filtered';
  row_count?: number;
  sort_field?: string;
  sort_label?: string;
  sort_order?: 'asc' | 'desc';
}

function formatOutputValueNumber(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  const scaled = n / 10000;
  return scaled.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function cellValue(row: StyleRow, key: string): string {
  if (key === 'fabric_readiness') {
    const parts = [row.fabric_readiness, row.accessories_readiness].filter(Boolean);
    return parts.join(' / ');
  }
  const v = row[key];
  if (v == null || v === '') return '';
  if (key === 'processing_output_value' || key === 'sales_output_value') {
    return formatOutputValueNumber(v);
  }
  if (STYLE_DATE_FIELDS.has(key)) return toYmdBeijing(v as string) || '';
  if (typeof v === 'boolean') return v ? '是' : '否';
  if (key === 'order_type') return v === 'processing' ? '加工' : '经销';
  return String(v);
}

function buildInfoLines(meta: EarlyWarningExportMeta): [string, string][] {
  const scopeLabel = meta.search_scope === 'global'
    ? '全局'
    : meta.search_scope === 'accumulate'
      ? '累计'
      : '局部';

  const lines: [string, string][] = [
    ['导出人', meta.export_user || '—'],
    ['导出时间', meta.export_time || '—'],
    ['导出模板', meta.template_name || '—'],
    ['搜索范围', scopeLabel],
    ['搜索关键词', meta.search_keyword?.trim() ? meta.search_keyword : '（无）'],
  ];

  if (meta.search_scope === 'global') {
    lines.push(['关账月份', '（全局搜索已忽略）']);
    lines.push(['字段筛选', '（全局搜索已忽略）']);
    lines.push(['仅未排单', '（全局搜索已忽略）']);
  } else if (meta.search_scope === 'accumulate') {
    lines.push(['关账月份', '（累计模式未应用）']);
    lines.push(['字段筛选', '（累计模式未应用）']);
    lines.push(['仅未排单', '（累计模式未应用）']);
  } else {
    const range = meta.closing_month_start && meta.closing_month_end
      ? `${meta.closing_month_start} ~ ${meta.closing_month_end}`
      : '（无）';
    lines.push(['关账月份', range]);
    if (meta.field_filter_field && meta.field_filter_values?.length) {
      const label = meta.field_filter_label || meta.field_filter_field;
      lines.push(['字段筛选', `${label}: ${meta.field_filter_values.join('、')}`]);
    } else {
      lines.push(['字段筛选', '（无）']);
    }
    lines.push(['仅未排单', meta.unscheduled_only ? '是' : '否']);
  }

  lines.push([
    '导出范围',
    meta.export_mode === 'selected'
      ? `选中 ${meta.row_count ?? 0} 条`
      : `当前筛选 ${meta.row_count ?? 0} 条`,
  ]);

  if (meta.sort_field) {
    const order = meta.sort_order === 'desc' ? '降序' : '升序';
    lines.push(['排序', `${meta.sort_label || meta.sort_field}（${order}）`]);
  } else {
    lines.push(['排序', '（无）']);
  }

  return lines;
}

async function loadStylesByIds(ids: number[]): Promise<StyleRow[]> {
  if (!ids.length) return [];
  const result = await query('SELECT * FROM styles WHERE id = ANY($1::int[])', [ids]);
  const map = new Map<number, StyleRow>();
  for (const row of result.rows as StyleRow[]) {
    map.set(Number(row.id), enrichStyle(row));
  }
  return ids.map((id) => map.get(id)).filter(Boolean) as StyleRow[];
}

function normalizeColumnKeys(keys: string[]): string[] {
  return keys.filter((k) => k && !EXPORT_EXCLUDED.has(k));
}

export async function exportEarlyWarningExcel(
  styleIds: number[],
  columnKeys: string[],
  meta: EarlyWarningExportMeta,
  templateConfig?: ExportTemplateConfig | null,
): Promise<Buffer> {
  const keys = normalizeColumnKeys(columnKeys);
  if (!keys.length) throw new Error('请至少选择一个导出字段');
  if (!styleIds.length) throw new Error('没有可导出的款式');

  const rowHeight = templateConfig?.rowHeight ?? EARLY_WARNING_EXPORT_ROW_HEIGHT;
  const headerFill = templateConfig?.headerStyle?.fillArgb ?? 'FF2563EB';
  const headerFontColor = templateConfig?.headerStyle?.fontColorArgb ?? 'FFFFFFFF';

  const rows = await loadStylesByIds(styleIds);
  const workbook = new ExcelJS.Workbook();

  const infoSheet = workbook.addWorksheet('导出信息');
  for (const [label, value] of buildInfoLines(meta)) {
    const row = infoSheet.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { vertical: 'middle', wrapText: true };
  }
  infoSheet.getColumn(1).width = 14;
  infoSheet.getColumn(2).width = 52;

  const sheet = workbook.addWorksheet('预警数据');
  const headers = keys.map((k) => getColumnTitle('early_warning', templateConfig, k));
  sheet.addRow(headers);

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: headerFontColor } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerFill } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;

  const imageColIndex = keys.indexOf('style_image');

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const values = keys.map((k) => (k === 'style_image' ? '' : cellValue(row, k)));
    sheet.addRow(values);

    const excelRow = sheet.getRow(rowNum);
    excelRow.height = rowHeight;
    excelRow.alignment = { vertical: 'middle', wrapText: true };
    if (imageColIndex >= 0 && row.style_image) {
      try {
        const img = await loadImageBuffer(String(row.style_image), IMAGE_PIXEL_SIZE);
        if (img) {
          const imageId = workbook.addImage({ buffer: img.buffer as never, extension: img.extension });
          sheet.addImage(imageId, {
            tl: { col: imageColIndex, row: rowNum - 1 },
            ext: { width: IMAGE_PIXEL_SIZE, height: IMAGE_PIXEL_SIZE },
            editAs: 'oneCell',
          });
        }
      } catch (imgErr) {
        console.warn('[export/early-warning] skip image for style', row.id, imgErr);
      }
    }

    excelRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  }

  sheet.columns.forEach((col, idx) => {
    const key = keys[idx];
    const configuredWidth = key ? getColumnWidth(templateConfig, key) : undefined;
    if (configuredWidth != null) {
      col.width = configuredWidth;
      return;
    }
    if (idx === imageColIndex) {
      col.width = 5;
      return;
    }    let maxLen = headers[idx]?.length || 8;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value || '').length;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(Math.max(maxLen + 2, 10), 36);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function buildEarlyWarningExportFilename(): string {
  return `预警导出_${todayYmdCompactBeijing()}.xlsx`;
}
