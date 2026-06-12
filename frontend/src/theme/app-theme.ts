import type { ThemeConfig } from 'antd';

/** 面向中文后台：偏大字号、高对比、大点击区域 */
export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: '#2563eb',
    colorLink: '#2563eb',
    colorLinkHover: '#1d4ed8',
    colorText: '#1f2937',
    colorTextSecondary: '#6b7280',
    colorTextHeading: '#111827',
    colorBgContainer: '#ffffff',
    colorBgLayout: '#f3f4f6',
    colorBorder: '#e5e7eb',
    colorBorderSecondary: '#f3f4f6',
    borderRadius: 10,
    borderRadiusLG: 12,
    borderRadiusSM: 8,
    fontFamily:
      '"Inter", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: 15,
    fontSizeLG: 17,
    fontSizeSM: 14,
    lineHeight: 1.6,
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
