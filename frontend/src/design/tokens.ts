/**
 * Design Tokens — 唯一数据源（JS）
 * 禁止在业务代码中硬编码色值/间距/字号，请引用此文件或 tokens.css 变量。
 */

export const spacing = {
  sp2: 2,
  sp8: 8,
  sp12: 12,
  sp16: 16,
  sp20: 20,
  sp24: 24,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 24,
} as const;

export const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const lineHeight = {
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.6,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
} as const;

export const colors = {
  primary: '#2563eb',
  success: '#52c41a',
  warning: '#faad14',
  danger: '#ff4d4f',
  textPrimary: 'rgba(0, 0, 0, 0.88)',
  textSecondary: 'rgba(0, 0, 0, 0.65)',
  textMuted: 'rgba(0, 0, 0, 0.45)',
  border: '#d9d9d9',
  bgSubtle: '#fafafa',
  bgContainer: '#ffffff',
  bgLayout: '#f3f4f6',
} as const;

export const layout = {
  kpiItemWidth: 120,
  kpiItemWidthWide: 260,
  heroImageSize: 96,
  statCardMinWidth: 108,
  thumbColumnWidth: 112,
} as const;

/** Ant Design ThemeConfig 对接 */
export const antDesignTokens = {
  colorPrimary: colors.primary,
  colorSuccess: colors.success,
  colorWarning: colors.warning,
  colorError: colors.danger,
  colorText: colors.textPrimary,
  colorTextSecondary: colors.textSecondary,
  colorTextTertiary: colors.textMuted,
  colorBorder: colors.border,
  colorBgContainer: colors.bgContainer,
  colorBgLayout: colors.bgLayout,
  borderRadius: radius.md,
  borderRadiusLG: radius.lg,
  borderRadiusSM: radius.sm,
  fontSize: fontSize.base,
  fontSizeLG: fontSize.lg,
  fontSizeSM: fontSize.sm,
  lineHeight: lineHeight.relaxed,
  controlHeight: 40,
} as const;

export type StatusTone = 'success' | 'warning' | 'danger' | 'primary' | 'default';
