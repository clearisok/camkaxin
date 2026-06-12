import { PRODUCTION_GROUP_IDS } from '@/utils/schedulingZone';

export { PRODUCTION_GROUP_IDS };

/** 表单/内联组别下拉（不含外发，外发走独立区位） */
export const GROUP_OPTIONS = [...PRODUCTION_GROUP_IDS];

export const READINESS_OPTIONS = [
  { value: '未到', label: '未到' },
  { value: '在途', label: '在途' },
  { value: '已到', label: '已到' },
  { value: '齐套', label: '齐套' },
  { value: '待确认', label: '待确认' },
];

export const SHORT_OVER_OPTIONS = [
  { value: '短装', label: '短装' },
  { value: '正常', label: '正常' },
  { value: '溢装', label: '溢装' },
];
