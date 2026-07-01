import ExcelJS from 'exceljs';
import { query } from '../config/database.js';
import { enrichStyle, enrichStyleForScheduling, type StyleRow } from '../utils/styleCalculations.js';
import { toYmdBeijing, todayYmdCompactBeijing } from '../utils/beijingTime.js';
import {
  collapseKeyForRow,
  schedulingZoneLabel,
  SCHEDULING_EXPORT_ZONE_ORDER,
  zoneKeyLabel,
} from '../utils/schedulingZone.js';
import { loadAllExceptionsMap } from './calendarExceptionService.js';
import {
  calcUnscheduledQuantity,
  effectiveAllocatedQuantity,
  isAwaitingSchedule,
  loadAllocatedMap,
} from './styleAllocation.js';
import { loadImageBuffer } from './excelExport.js';
import {
  type ExportTemplateConfig,
  getColumnTitle,
  getColumnWidth,
} from './exportTemplateService.js';

export const SCHEDULING_EXPORT_ROW_HEIGHT = 20;
const IMAGE_PIXEL_SIZE = 18;
const EXPORT_EXCLUDED = new Set(['action', 'row_edit', 'move_target']);

const STYLE_DATE_FIELDS = new Set([
  'required_shipping_date', 'first_bed_time', 'online_time', 'offline_time',
]);

export interface SchedulingExportMeta {
  export_user?: string;
  export_time?: string;
  template_name?: string;
  search_keyword?: string;
  export_mode?: 'filtered' | 'zones';
  zone_keys?: string[];
  zone_labels?: string[];
  row_count?: number;
}

function formatOutputValueNumber(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  const scaled = n / 10000;
  return scaled.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function cellValue(row: StyleRow, key: string): string {
  if (key === 'scheduling_zone_label') return schedulingZoneLabel(row);
  if (key === 'fabric_readiness') {
    const parts = [row.fabric_readiness, row.accessories_readiness].filter(Boolean);
    return parts.join(' / ');
  }
  if (key === 'group_name') {
    const zone = schedulingZoneLabel(row);
    if (zone.includes('生产组') || zone === '外发订单') return zone;
    const g = row.group_name;
    return g ? String(g) : '';
  }
  const v = row[key];
  if (v == null || v === '') return '';
  if (key === 'processing_output_value' || key === 'sales_output_value') {
    return formatOutputValueNumber(v);
  }
  if (STYLE_DATE_FIELDS.has(key)) return toYmdBeijing(v as string) || '';
  if (typeof v === 'boolean') return v ? '是' : '否';
  return String(v);
}

function buildInfoLines(meta: SchedulingExportMeta): [string, string][] {
  const lines: [string, string][] = [
    ['导出人', meta.export_user || '—'],
    ['导出时间', meta.export_time || '—'],
    ['导出模板', meta.template_name || '—'],
    ['搜索关键词', meta.search_keyword?.trim() ? meta.search_keyword : '（无）'],
    ['下线区', '已排除，不输出'],
    ['待排单', '与页面一致：仅仍有未排数量的母单'],
    ['分组顺序', '待排单 → 1–13、15、16 生产组 → 外发订单（每组前重复表头）'],
  ];

  if (meta.export_mode === 'zones' && meta.zone_labels?.length) {
    lines.push(['导出范围', `指定区位：${meta.zone_labels.join('、')}`]);
  } else {
    lines.push(['导出范围', `当前筛选 ${meta.row_count ?? 0} 条`]);
  }

  lines.push(['导出行数', String(meta.row_count ?? 0)]);
  return lines;
}

async function loadStylesByIds(ids: number[]): Promise<StyleRow[]> {
  if (!ids.length) return [];
  const exceptions = await loadAllExceptionsMap();
  const result = await query('SELECT * FROM styles WHERE id = ANY($1::int[])', [ids]);
  const map = new Map<number, StyleRow>();
  for (const row of result.rows as StyleRow[]) {
    map.set(Number(row.id), enrichStyleForScheduling(enrichStyle(row), exceptions));
  }
  const rows = ids.map((id) => map.get(id)).filter(Boolean) as StyleRow[];
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

function normalizeColumnKeys(keys: string[]): string[] {
  return keys.filter((k) => k && !EXPORT_EXCLUDED.has(k));
}

function compareRowsInZone(a: StyleRow, b: StyleRow): number {
  const sa = a.sort_order != null ? Number(a.sort_order) : Number.MAX_SAFE_INTEGER;
  const sb = b.sort_order != null ? Number(b.sort_order) : Number.MAX_SAFE_INTEGER;
  if (sa !== sb) return sa - sb;
  const na = String(a.style_number ?? '');
  const nb = String(b.style_number ?? '');
  return na.localeCompare(nb, 'zh-CN');
}

function groupRowsForExport(rows: StyleRow[], zoneFilter?: Set<string>): Map<string, StyleRow[]> {
  const grouped = new Map<string, StyleRow[]>();
  for (const row of rows) {
    const key = collapseKeyForRow(row);
    if (key === 'offline') continue;
    if (key === 'wait' && !isAwaitingSchedule(row)) continue;
    if (zoneFilter && !zoneFilter.has(key)) continue;
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }
  for (const list of grouped.values()) {
    list.sort(compareRowsInZone);
  }
  return grouped;
}

function applyHeaderRowStyle(
  row: ExcelJS.Row,
  headerFill: string,
  headerFontColor: string,
) {
  row.font = { bold: true, color: { argb: headerFontColor } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerFill } };
  row.alignment = { vertical: 'middle', horizontal: 'center' };
  row.height = 24;
}

function applyDataRowBorder(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };
  });
}

export async function exportSchedulingExcel(
  styleIds: number[],
  columnKeys: string[],
  meta: SchedulingExportMeta,
  templateConfig?: ExportTemplateConfig | null,
): Promise<Buffer> {
  const keys = normalizeColumnKeys(columnKeys);
  if (!keys.length) throw new Error('请至少选择一个导出字段');
  if (!styleIds.length) throw new Error('没有可导出的款式');

  const rowHeight = templateConfig?.rowHeight ?? SCHEDULING_EXPORT_ROW_HEIGHT;
  const headerFill = templateConfig?.headerStyle?.fillArgb ?? 'FF2563EB';
  const headerFontColor = templateConfig?.headerStyle?.fontColorArgb ?? 'FFFFFFFF';

  const allRows = await loadStylesByIds(styleIds);
  const zoneFilter = meta.export_mode === 'zones' && meta.zone_keys?.length
    ? new Set(meta.zone_keys.filter((k) => k !== 'offline'))
    : undefined;
  const grouped = groupRowsForExport(allRows, zoneFilter);

  const exportRows: StyleRow[] = [];
  for (const zoneKey of SCHEDULING_EXPORT_ZONE_ORDER) {
    const list = grouped.get(zoneKey);
    if (list?.length) exportRows.push(...list);
  }
  if (!exportRows.length) throw new Error('没有可导出的款式（已排除下线区）');

  const workbook = new ExcelJS.Workbook();

  const infoSheet = workbook.addWorksheet('导出信息');
  for (const [label, value] of buildInfoLines(meta)) {
    const row = infoSheet.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { vertical: 'middle', wrapText: true };
  }
  infoSheet.getColumn(1).width = 14;
  infoSheet.getColumn(2).width = 52;

  const sheet = workbook.addWorksheet('排单数据');
  const headers = keys.map((k) => getColumnTitle('scheduling', templateConfig, k));
  const imageColIndex = keys.indexOf('style_image');

  for (const zoneKey of SCHEDULING_EXPORT_ZONE_ORDER) {
    const groupRows = grouped.get(zoneKey);
    if (!groupRows?.length) continue;

    const headerExcelRow = sheet.addRow(headers);
    applyHeaderRowStyle(headerExcelRow, headerFill, headerFontColor);

    for (const row of groupRows) {
      const values = keys.map((k) => (k === 'style_image' ? '' : cellValue(row, k)));
      const dataRow = sheet.addRow(values);
      const excelRowNum = dataRow.number;

      dataRow.height = rowHeight;
      dataRow.alignment = { vertical: 'middle', wrapText: true };
      applyDataRowBorder(dataRow);

      if (imageColIndex >= 0 && row.style_image) {
        try {
          const img = await loadImageBuffer(String(row.style_image), IMAGE_PIXEL_SIZE);
          if (img) {
            const imageId = workbook.addImage({ buffer: img.buffer as never, extension: img.extension });
            sheet.addImage(imageId, {
              tl: { col: imageColIndex, row: excelRowNum - 1 },
              ext: { width: IMAGE_PIXEL_SIZE, height: IMAGE_PIXEL_SIZE },
              editAs: 'oneCell',
            });
          }
        } catch (imgErr) {
          console.warn('[export/scheduling] skip image for style', row.id, imgErr);
        }
      }
    }
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
    }
    let maxLen = headers[idx]?.length || 8;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value || '').length;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(Math.max(maxLen + 2, 10), 36);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function buildSchedulingExportFilename(): string {
  return `排单导出_${todayYmdCompactBeijing()}.xlsx`;
}

export { zoneKeyLabel };
