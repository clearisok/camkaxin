/** 从 Express 路由参数中安全解析 ID */
export function parseId(param: string | string[] | undefined): number {
  const value = Array.isArray(param) ? param[0] : param;
  return parseInt(value || '0', 10);
}
