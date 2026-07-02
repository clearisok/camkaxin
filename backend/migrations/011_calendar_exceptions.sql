-- 工作日历例外：旧版单日 exception_date；db:init 已含 start_date/end_date 时跳过

DO $$
BEGIN
  -- 已是新结构（schema.sql / db:init / 012 已执行）
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'calendar_exceptions' AND column_name = 'start_date'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_range ON calendar_exceptions(start_date, end_date);
    CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_source ON calendar_exceptions(source);
    RETURN;
  END IF;

  -- 旧库：创建单日结构表
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'calendar_exceptions'
  ) THEN
    CREATE TABLE calendar_exceptions (
      id SERIAL PRIMARY KEY,
      exception_date DATE NOT NULL UNIQUE,
      day_type VARCHAR(10) NOT NULL CHECK (day_type IN ('holiday', 'workday')),
      name VARCHAR(200),
      source VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'cambodia')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'calendar_exceptions' AND column_name = 'exception_date'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_date ON calendar_exceptions(exception_date);
    CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_source ON calendar_exceptions(source);
  END IF;
END $$;

COMMENT ON TABLE calendar_exceptions IS '工作日历例外：holiday=休息，workday=补班上班';
COMMENT ON COLUMN calendar_exceptions.day_type IS 'holiday 休息日 / workday 补班上班';
