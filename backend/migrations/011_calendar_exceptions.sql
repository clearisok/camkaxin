-- 工作日历例外：在默认「周一至周六工作、周日休息」基础上标记假期或补班
CREATE TABLE IF NOT EXISTS calendar_exceptions (
  id SERIAL PRIMARY KEY,
  exception_date DATE NOT NULL UNIQUE,
  day_type VARCHAR(10) NOT NULL CHECK (day_type IN ('holiday', 'workday')),
  name VARCHAR(200),
  source VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'cambodia')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_date ON calendar_exceptions(exception_date);
CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_source ON calendar_exceptions(source);

COMMENT ON TABLE calendar_exceptions IS '工作日历例外：holiday=休息，workday=补班上班';
COMMENT ON COLUMN calendar_exceptions.day_type IS 'holiday 休息日 / workday 补班上班';
