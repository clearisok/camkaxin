-- 日历例外改为时间段（start_date ~ end_date）
-- 若已是 start_date/end_date 且无 exception_date（db:init）则跳过

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'calendar_exceptions'
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'calendar_exceptions' AND column_name = 'start_date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'calendar_exceptions' AND column_name = 'exception_date'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_range ON calendar_exceptions(start_date, end_date);
    RETURN;
  END IF;

  ALTER TABLE calendar_exceptions ADD COLUMN IF NOT EXISTS start_date DATE;
  ALTER TABLE calendar_exceptions ADD COLUMN IF NOT EXISTS end_date DATE;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'calendar_exceptions' AND column_name = 'exception_date'
  ) THEN
    UPDATE calendar_exceptions
    SET start_date = exception_date, end_date = exception_date
    WHERE start_date IS NULL AND exception_date IS NOT NULL;

    ALTER TABLE calendar_exceptions DROP CONSTRAINT IF EXISTS calendar_exceptions_exception_date_key;
    DROP INDEX IF EXISTS idx_calendar_exceptions_date;
    ALTER TABLE calendar_exceptions DROP COLUMN IF EXISTS exception_date;
  END IF;

  UPDATE calendar_exceptions SET start_date = COALESCE(start_date, CURRENT_DATE),
    end_date = COALESCE(end_date, CURRENT_DATE)
  WHERE start_date IS NULL OR end_date IS NULL;

  ALTER TABLE calendar_exceptions ALTER COLUMN start_date SET NOT NULL;
  ALTER TABLE calendar_exceptions ALTER COLUMN end_date SET NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_range ON calendar_exceptions(start_date, end_date);
END $$;

COMMENT ON COLUMN calendar_exceptions.start_date IS '例外开始日（含）';
COMMENT ON COLUMN calendar_exceptions.end_date IS '例外结束日（含）';
