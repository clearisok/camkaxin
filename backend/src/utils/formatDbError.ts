/** 将数据库/网络错误转为可读提示 */
export function formatDbError(err: unknown): string {
  if (err instanceof AggregateError) {
    const parts = err.errors?.map((e) => (e instanceof Error ? e.message : String(e))).filter(Boolean) ?? [];
    if (parts.some((p) => p.includes('ECONNREFUSED') || p.includes('5432'))) {
      return '数据库连接失败：PostgreSQL 未启动，请在项目根目录运行 docker compose up -d';
    }
    return parts.join('; ') || err.message || '数据库错误';
  }
  const e = err as Error & { code?: string };
  if (e.code === 'ECONNREFUSED' || e.message?.includes('ECONNREFUSED')) {
    return '数据库连接失败：PostgreSQL 未启动，请在项目根目录运行 docker compose up -d';
  }
  if (e.code === '57P01' || e.message?.includes('terminating connection')) {
    return '数据库连接已断开（可能正在重启），请稍后重试或重启后端 npm run dev';
  }
  if (e.code === '42P01') {
    return `数据库表不存在，请运行 npm run db:migrate：${e.message}`;
  }
  if (e.code === '42703') {
    return `数据库字段缺失，请运行 npm run db:migrate：${e.message}`;
  }
  if (e.code === '28P01') {
    return '数据库认证失败：用户 jiankai 密码不正确。当前可能连接到了本机 PostgreSQL（5432）而非项目 Docker 数据库（5433）。请确认 backend/.env 使用端口 5433，并运行 docker compose up -d。';
  }
  if (e.message?.includes('\uFFFD')) {
    return '数据库认证失败：错误信息乱码说明连接到了 Windows 本机 PostgreSQL（GBK 编码）。请改用端口 5433 连接 Docker 数据库。';
  }
  return e.message || String(err);
}
