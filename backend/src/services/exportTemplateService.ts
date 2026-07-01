import { query } from '../config/database.js';

export type ExportTemplateView = 'early_warning' | 'scheduling';

export const EXPORT_EXCLUDED_KEYS = new Set(['action', 'row_edit', 'move_target']);

export const EARLY_WARNING_FIELD_TITLES: Record<string, string> = {
  style_number: '款号',
  brand: '品牌',
  quantity: '数量',
  style_name: '款式名称',
  salesperson: '业务员',
  po_number: 'PO号',
  required_shipping_date: '要求出货日',
  closing_month: '关账月份',
  remarks: '备注',
  style_image: '款式图',
  fabric_readiness: '面辅料',
  fabric_structure: '面料结构',
  sample_progress: '样衣进度',
  printing_embroidery: '印绣花',
  order_follower: '跟单员',
  processing_unit_price: '加工单价',
  processing_output_value: '加工产值（万美金）',
  sales_price: '销售单价',
  order_type: '订单类型',
  cancelled_quantity: '取消件数',
  sales_output_value: '销售产值（万元）',
  required_days: '所需天数',
  is_outsourced: '是否外发',
  group_name: '排入组别',
  outsourced_factory: '外发工厂',
  outsourced_price: '外发单价',
  online_time: '上线时间',
  offline_time: '下线时间',
};

/** 排单导出字段（含虚拟列 scheduling_zone_label） */
export const SCHEDULING_FIELD_TITLES: Record<string, string> = {
  scheduling_zone_label: '区位',
  style_number: '款号',
  brand: '品牌',
  style_name: '款式名称',
  salesperson: '业务员',
  po_number: 'PO号',
  quantity: '订单数量',
  required_shipping_date: '要求出货日',
  fabric_readiness: '面辅料进度',
  online_time: '上线时间',
  offline_time: '下线时间',
  required_days: '所需天数',
  holiday_days: '假期天数',
  scheduled_output: '排入数量',
  avg_daily_output: '日均产量',
  scheduling_remarks: '排单备注',
  group_name: '排入组别',
  is_outsourced: '是否外发',
  outsourced_factory: '外发工厂',
  outsourced_price: '外发单价',
  style_image: '款式图',
};

/** @deprecated use getFieldTitles(view) */
export const EXPORT_FIELD_TITLES = EARLY_WARNING_FIELD_TITLES;

export function getFieldTitles(view: ExportTemplateView): Record<string, string> {
  return view === 'scheduling' ? SCHEDULING_FIELD_TITLES : EARLY_WARNING_FIELD_TITLES;
}

export interface ExportTemplateColumn {
  key: string;
  title?: string;
  width?: number;
}

export interface ExportTemplateHeaderStyle {
  fillArgb?: string;
  fontColorArgb?: string;
}

export interface ExportTemplateConfig {
  columns: ExportTemplateColumn[];
  defaultSelected?: string[];
  headerStyle?: ExportTemplateHeaderStyle;
  rowHeight?: number;
}

/** @deprecated */
export type EarlyWarningTemplateColumn = ExportTemplateColumn;
/** @deprecated */
export type EarlyWarningTemplateHeaderStyle = ExportTemplateHeaderStyle;
/** @deprecated */
export type EarlyWarningTemplateConfig = ExportTemplateConfig;

export interface ExportTemplateRow {
  id: number;
  name: string;
  view: ExportTemplateView;
  config: ExportTemplateConfig;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/** @deprecated */
export type EarlyWarningExportTemplateRow = ExportTemplateRow;

export interface ResolveExportColumnsResult {
  keys: string[];
  unconfigured: string[];
}

function normalizeConfig(raw: unknown): ExportTemplateConfig {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Partial<ExportTemplateConfig>;
  const columns = Array.isArray(obj.columns)
    ? obj.columns
      .filter((c): c is ExportTemplateColumn => !!c && typeof c.key === 'string' && c.key.length > 0)
      .map((c) => ({
        key: c.key,
        title: typeof c.title === 'string' && c.title.trim() ? c.title.trim() : undefined,
        width: typeof c.width === 'number' && Number.isFinite(c.width) ? c.width : undefined,
      }))
    : [];

  const defaultSelected = Array.isArray(obj.defaultSelected)
    ? obj.defaultSelected.filter((k): k is string => typeof k === 'string' && k.length > 0)
    : undefined;

  const headerStyle = obj.headerStyle && typeof obj.headerStyle === 'object'
    ? {
      fillArgb: typeof obj.headerStyle.fillArgb === 'string' ? obj.headerStyle.fillArgb : undefined,
      fontColorArgb: typeof obj.headerStyle.fontColorArgb === 'string' ? obj.headerStyle.fontColorArgb : undefined,
    }
    : undefined;

  const rowHeight = typeof obj.rowHeight === 'number' && obj.rowHeight > 0 ? obj.rowHeight : undefined;

  return { columns, defaultSelected, headerStyle, rowHeight };
}

export function buildDefaultTemplateConfig(view: ExportTemplateView): ExportTemplateConfig {
  const titles = getFieldTitles(view);
  const keys = Object.keys(titles);
  if (view === 'scheduling') {
    return {
      columns: keys.map((key) => ({
        key,
        title: titles[key],
        width: key === 'style_image' ? 5 : key === 'scheduling_zone_label' ? 12 : undefined,
      })),
      defaultSelected: [
        'scheduling_zone_label', 'style_number', 'brand', 'group_name', 'quantity',
        'online_time', 'offline_time', 'scheduled_output',
      ],
      headerStyle: { fillArgb: 'FF2563EB', fontColorArgb: 'FFFFFFFF' },
      rowHeight: 20,
    };
  }
  return {
    columns: keys.map((key) => ({
      key,
      title: titles[key],
      width: key === 'style_image' ? 5 : undefined,
    })),
    defaultSelected: [
      'style_number', 'brand', 'quantity', 'style_name', 'salesperson',
      'required_shipping_date', 'closing_month', 'fabric_readiness',
    ],
    headerStyle: { fillArgb: 'FF2563EB', fontColorArgb: 'FFFFFFFF' },
    rowHeight: 20,
  };
}

export function filterExportColumnKeys(keys: string[]): string[] {
  return keys.filter((k) => k && !EXPORT_EXCLUDED_KEYS.has(k));
}

export function resolveExportColumns(
  templateConfig: ExportTemplateConfig | null | undefined,
  userSelectedKeys: string[],
): ResolveExportColumnsResult {
  const selected = filterExportColumnKeys(userSelectedKeys);
  if (!selected.length) return { keys: [], unconfigured: [] };

  if (!templateConfig?.columns?.length) {
    return { keys: selected, unconfigured: [] };
  }

  const selectedSet = new Set(selected);
  const templateKeys = templateConfig.columns.map((c) => c.key);
  const templateSet = new Set(templateKeys);
  const inTemplate = templateKeys.filter((k) => selectedSet.has(k));
  const unconfigured = selected.filter((k) => !templateSet.has(k));
  return { keys: [...inTemplate, ...unconfigured], unconfigured };
}

export function getColumnTitle(
  view: ExportTemplateView,
  config: ExportTemplateConfig | null | undefined,
  key: string,
): string {
  const col = config?.columns?.find((c) => c.key === key);
  return col?.title || getFieldTitles(view)[key] || key;
}

export function getColumnWidth(config: ExportTemplateConfig | null | undefined, key: string): number | undefined {
  const col = config?.columns?.find((c) => c.key === key);
  return col?.width;
}

export function validateTemplateConfig(view: ExportTemplateView, config: ExportTemplateConfig): string | null {
  const titles = getFieldTitles(view);
  if (!config.columns.length) return '模板至少包含一列';
  const seen = new Set<string>();
  for (const col of config.columns) {
    if (!titles[col.key]) return `未知字段：${col.key}`;
    if (seen.has(col.key)) return `重复字段：${col.key}`;
    seen.add(col.key);
  }
  if (config.defaultSelected?.some((k) => !seen.has(k))) {
    return '默认勾选字段必须在模板列中';
  }
  return null;
}

function mapRow(row: Record<string, unknown>): ExportTemplateRow {
  const view = String(row.view || 'early_warning') as ExportTemplateView;
  return {
    id: Number(row.id),
    name: String(row.name),
    view: view === 'scheduling' ? 'scheduling' : 'early_warning',
    config: normalizeConfig(row.config),
    is_default: Boolean(row.is_default),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function seedDefaultTemplateIfEmpty(view: ExportTemplateView, defaultConfig: ExportTemplateConfig) {
  const existing = await query(
    'SELECT id FROM early_warning_export_templates WHERE view = $1 LIMIT 1',
    [view],
  );
  if (existing.rows.length > 0) return;
  const defaultName = view === 'scheduling' ? '默认排单导出' : '默认预警导出';
  await query(
    `INSERT INTO early_warning_export_templates (name, config, is_default, view)
     VALUES ($1, $2::jsonb, TRUE, $3)`,
    [defaultName, JSON.stringify(defaultConfig), view],
  );
}

export async function listExportTemplates(view: ExportTemplateView): Promise<ExportTemplateRow[]> {
  const result = await query(
    'SELECT * FROM early_warning_export_templates WHERE view = $1 ORDER BY is_default DESC, updated_at DESC',
    [view],
  );
  return result.rows.map((r) => mapRow(r as Record<string, unknown>));
}

export async function getExportTemplateById(id: number): Promise<ExportTemplateRow | null> {
  const result = await query('SELECT * FROM early_warning_export_templates WHERE id = $1', [id]);
  if (!result.rows[0]) return null;
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function getDefaultExportTemplate(view: ExportTemplateView): Promise<ExportTemplateRow | null> {
  const result = await query(
    'SELECT * FROM early_warning_export_templates WHERE view = $1 AND is_default = TRUE ORDER BY id LIMIT 1',
    [view],
  );
  if (!result.rows[0]) {
    const fallback = await query(
      'SELECT * FROM early_warning_export_templates WHERE view = $1 ORDER BY id LIMIT 1',
      [view],
    );
    if (!fallback.rows[0]) return null;
    return mapRow(fallback.rows[0] as Record<string, unknown>);
  }
  return mapRow(result.rows[0] as Record<string, unknown>);
}

async function clearDefaultFlag(view: ExportTemplateView, exceptId?: number) {
  if (exceptId != null) {
    await query(
      'UPDATE early_warning_export_templates SET is_default = FALSE WHERE view = $1 AND id <> $2',
      [view, exceptId],
    );
  } else {
    await query(
      'UPDATE early_warning_export_templates SET is_default = FALSE WHERE view = $1',
      [view],
    );
  }
}

export async function createExportTemplate(
  view: ExportTemplateView,
  name: string,
  config: ExportTemplateConfig,
  isDefault = false,
): Promise<ExportTemplateRow> {
  const normalized = normalizeConfig(config);
  const err = validateTemplateConfig(view, normalized);
  if (err) throw new Error(err);
  if (isDefault) await clearDefaultFlag(view);
  const result = await query(
    `INSERT INTO early_warning_export_templates (name, config, is_default, view, updated_at)
     VALUES ($1, $2::jsonb, $3, $4, NOW()) RETURNING *`,
    [name.trim(), JSON.stringify(normalized), isDefault, view],
  );
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function updateExportTemplate(
  id: number,
  patch: { name?: string; config?: ExportTemplateConfig; is_default?: boolean },
): Promise<ExportTemplateRow | null> {
  const existing = await getExportTemplateById(id);
  if (!existing) return null;

  const name = patch.name?.trim() || existing.name;
  const config = patch.config ? normalizeConfig(patch.config) : existing.config;
  const err = validateTemplateConfig(existing.view, config);
  if (err) throw new Error(err);

  const isDefault = patch.is_default ?? existing.is_default;
  if (isDefault) await clearDefaultFlag(existing.view, id);

  const result = await query(
    `UPDATE early_warning_export_templates
     SET name = $1, config = $2::jsonb, is_default = $3, updated_at = NOW()
     WHERE id = $4 RETURNING *`,
    [name, JSON.stringify(config), isDefault, id],
  );
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function deleteExportTemplate(id: number): Promise<boolean> {
  const existing = await getExportTemplateById(id);
  if (!existing) return false;
  await query('DELETE FROM early_warning_export_templates WHERE id = $1', [id]);
  if (existing.is_default) {
    const next = await query(
      'SELECT id FROM early_warning_export_templates WHERE view = $1 ORDER BY updated_at DESC LIMIT 1',
      [existing.view],
    );
    if (next.rows[0]) {
      await query('UPDATE early_warning_export_templates SET is_default = TRUE WHERE id = $1', [
        (next.rows[0] as { id: number }).id,
      ]);
    } else {
      await seedDefaultTemplateIfEmpty(existing.view, buildDefaultTemplateConfig(existing.view));
    }
  }
  return true;
}

export async function resolveTemplateForExport(
  view: ExportTemplateView,
  templateId?: number | null,
) {
  if (templateId != null && Number.isFinite(templateId)) {
    const tpl = await getExportTemplateById(Number(templateId));
    if (tpl && tpl.view === view) return tpl;
  }
  return getDefaultExportTemplate(view);
}

// 兼容旧 API
export const listEarlyWarningExportTemplates = () => listExportTemplates('early_warning');
export const getEarlyWarningExportTemplateById = getExportTemplateById;
export const getDefaultEarlyWarningExportTemplate = () => getDefaultExportTemplate('early_warning');
export const createEarlyWarningExportTemplate = (
  name: string,
  config: ExportTemplateConfig,
  isDefault = false,
) => createExportTemplate('early_warning', name, config, isDefault);
export const updateEarlyWarningExportTemplate = updateExportTemplate;
export const deleteEarlyWarningExportTemplate = deleteExportTemplate;
