import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/database.js';
import { formatDbError } from '../utils/formatDbError.js';
import { debugLog } from '../utils/debugLog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function init() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  console.log('Initializing database schema...');
  await pool.query(schema);
  console.log('Database schema initialized successfully.');
  await pool.end();
}

init().catch((err) => {
  const e = err as Error & { code?: string };
  // #region agent log
  debugLog('init.ts', 'db:init failed', {
    code: e.code,
    message: e.message,
    databaseUrlPort: process.env.DATABASE_URL?.match(/:(\d+)\//)?.[1] ?? 'unknown',
  }, 'A');
  // #endregion
  console.error('Failed to initialize database:', formatDbError(err));
  process.exit(1);
});
