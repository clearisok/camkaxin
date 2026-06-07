import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://jiankai:jiankai123@localhost:5432/jiankai_quotation',
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
