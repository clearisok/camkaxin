ALTER TABLE early_warning_export_templates
  ADD COLUMN IF NOT EXISTS view VARCHAR(32) NOT NULL DEFAULT 'early_warning';

DROP INDEX IF EXISTS idx_early_warning_export_templates_default;

CREATE UNIQUE INDEX IF NOT EXISTS idx_export_templates_default_view
  ON early_warning_export_templates (view)
  WHERE is_default = TRUE;
