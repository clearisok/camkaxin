import type { ThemeConfig } from 'antd';
import { antDesignTokens, colors, fontSize, radius } from '@/design/tokens';

/** 面向中文后台：Design Tokens 驱动 Ant Design 主题 */
export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: antDesignTokens.colorPrimary,
    colorLink: antDesignTokens.colorPrimary,
    colorLinkHover: antDesignTokens.colorPrimary,
    colorText: antDesignTokens.colorText,
    colorTextSecondary: antDesignTokens.colorTextSecondary,
    colorTextHeading: colors.textPrimary,
    colorBgContainer: antDesignTokens.colorBgContainer,
    colorBgLayout: antDesignTokens.colorBgLayout,
    colorBorder: antDesignTokens.colorBorder,
    colorBorderSecondary: colors.bgSubtle,
    borderRadius: radius.md,
    borderRadiusLG: radius.lg,
    borderRadiusSM: radius.sm,
    fontFamily:
      '"Inter", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: antDesignTokens.fontSize,
    fontSizeLG: antDesignTokens.fontSizeLG,
    fontSizeSM: antDesignTokens.fontSizeSM,
    lineHeight: antDesignTokens.lineHeight,
    controlHeight: 40,
    controlHeightLG: 44,
    controlHeightSM: 36,
    motionDurationMid: '0.2s',
  },
  components: {
    Button: {
      contentFontSize: 15,
      contentFontSizeLG: 16,
      fontWeight: 500,
      primaryShadow: 'none',
      defaultShadow: 'none',
    },
    Table: {
      headerBg: '#f9fafb',
      headerColor: '#374151',
      rowHoverBg: '#f3f4f6',
      cellFontSize: 15,
      cellPaddingBlock: 14,
      cellPaddingInline: 16,
    },
    Form: {
      labelFontSize: 14,
      labelColor: '#374151',
      itemMarginBottom: 20,
    },
    Input: {
      inputFontSize: 15,
      paddingBlock: 8,
      paddingInline: 14,
    },
    Select: {
      optionFontSize: 15,
    },
    Menu: {
      itemHeight: 44,
      fontSize: 15,
      darkItemBg: 'transparent',
      darkSubMenuItemBg: 'transparent',
    },
    Card: {
      headerFontSize: 17,
      paddingLG: 24,
    },
    Tabs: {
      titleFontSize: 15,
      inkBarColor: '#2563eb',
    },
    Modal: {
      titleFontSize: 18,
    },
  },
};
