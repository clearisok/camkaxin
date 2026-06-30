import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

function withBeijingTimezone(url: string): string {
  if (/options=.*TimeZone/i.test(url)) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}options=-c%20TimeZone%3DAsia%2FShanghai`;
}

const connectionString = withBeijingTimezone(
  process.env.DATABASE_URL ||
    'postgresql://jiankai:jiankai123@localhost:5433/jiankai_quotation',
);

export const pool = new Pool({ connectionString });

// Prevent Node process crash when idle clients lose connection (e.g. Docker PG restart)
pool.on('error', (err) => {
  // #region agent log
  void import('../utils/debugLog.js').then(({ debugLog }) => {
    debugLog('database.ts:pool', 'Idle pool client error (handled)', {
      code: (err as NodeJS.ErrnoException & { code?: string }).code,
      message: err.message,
    }, 'H1');
  });
  // #endregion
  console.error('PostgreSQL pool idle client error:', err.message);
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  try {
    return await pool.query<T>(text, params);
  } catch (err) {
    const { debugLog } = await import('../utils/debugLog.js');
    const { formatDbError } = await import('../utils/formatDbError.js');
    const e = err as Error & { code?: string; errors?: Error[] };
    debugLog('database.ts:query', 'DB query failed', {
      code: e.code,
      message: e.message,
      name: e.name,
      aggregateErrors: e.errors?.map((x) => x.message),
      sqlPreview: text.slice(0, 80),
    }, 'A');
    throw new Error(formatDbError(err));
  }
}

export async function getClient() {
  return pool.connect();
}
