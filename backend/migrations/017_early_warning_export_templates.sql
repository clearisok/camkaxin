CREATE TABLE IF NOT EXISTS early_warning_export_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_early_warning_export_templates_default
  ON early_warning_export_templates (is_default)
  WHERE is_default = TRUE;
