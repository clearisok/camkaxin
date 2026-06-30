import { query } from '../config/database.js';

export async function ensureClosingLockSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS closing_month_locks (
      closing_month VARCHAR(7) PRIMARY KEY,
      locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      locked_by VARCHAR(100) NOT NULL DEFAULT 'system',
      style_count INT NOT NULL DEFAULT 0,
      total_sales_output_value NUMERIC(16, 2) NOT NULL DEFAULT 0,
      total_processing_output_value NUMERIC(16, 2) NOT NULL DEFAULT 0
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_closing_month_locks_locked_at
    ON closing_month_locks(locked_at DESC)
  `);
}
