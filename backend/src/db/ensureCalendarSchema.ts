import { query } from '../config/database.js';

export async function ensureCalendarSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS calendar_exceptions (
      id SERIAL PRIMARY KEY,
      start_date DATE NOT NULL DEFAULT CURRENT_DATE,
      end_date DATE NOT NULL DEFAULT CURRENT_DATE,
      day_type VARCHAR(10) NOT NULL CHECK (day_type IN ('holiday', 'workday')),
      name VARCHAR(200),
      source VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'cambodia')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query('ALTER TABLE calendar_exceptions ADD COLUMN IF NOT EXISTS start_date DATE');
  await query('ALTER TABLE calendar_exceptions ADD COLUMN IF NOT EXISTS end_date DATE');
  await query('ALTER TABLE calendar_exceptions ADD COLUMN IF NOT EXISTS exception_date DATE');

  await query(`
    UPDATE calendar_exceptions
    SET start_date = exception_date, end_date = exception_date
    WHERE start_date IS NULL AND exception_date IS NOT NULL
  `);

  await query(`
    UPDATE calendar_exceptions
    SET start_date = COALESCE(start_date, CURRENT_DATE),
        end_date = COALESCE(end_date, start_date, CURRENT_DATE)
    WHERE start_date IS NULL OR end_date IS NULL
  `);

  await query('ALTER TABLE calendar_exceptions DROP CONSTRAINT IF EXISTS calendar_exceptions_exception_date_key');
  await query('ALTER TABLE calendar_exceptions DROP COLUMN IF EXISTS exception_date');

  await query(`
    ALTER TABLE calendar_exceptions
      ALTER COLUMN start_date SET NOT NULL,
      ALTER COLUMN end_date SET NOT NULL
  `);

  await query('CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_range ON calendar_exceptions(start_date, end_date)');
}
