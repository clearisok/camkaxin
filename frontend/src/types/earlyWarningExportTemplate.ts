/** 预警导出模板 JSON 配置（前后端共用结构） */

export interface EarlyWarningTemplateColumn {
  key: string;
  title?: string;
  width?: number;
}

export interface EarlyWarningTemplateHeaderStyle {
  fillArgb?: string;
  fontColorArgb?: string;
}

export interface EarlyWarningTemplateConfig {
  columns: EarlyWarningTemplateColumn[];
  defaultSelected?: string[];
  headerStyle?: EarlyWarningTemplateHeaderStyle;
  rowHeight?: number;
}

export type ExportTemplateView = 'early_warning' | 'scheduling';

export interface EarlyWarningExportTemplate {
  id: number;
  name: string;
  view?: ExportTemplateView;
  config: EarlyWarningTemplateConfig;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResolveExportColumnsResult {
  keys: string[];
  unconfigured: string[];
}
