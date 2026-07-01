import { query } from '../config/database.js';
import { buildDefaultTemplateConfig, seedDefaultTemplateIfEmpty } from '../services/exportTemplateService.js';

export async function ensureEarlyWarningExportTemplateSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS early_warning_export_templates (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      config JSONB NOT NULL DEFAULT '{}',
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      view VARCHAR(32) NOT NULL DEFAULT 'early_warning',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    ALTER TABLE early_warning_export_templates
      ADD COLUMN IF NOT EXISTS view VARCHAR(32) NOT NULL DEFAULT 'early_warning'
  `);
  await query(`
    DROP INDEX IF EXISTS idx_early_warning_export_templates_default
  `);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_export_templates_default_view
      ON early_warning_export_templates (view)
      WHERE is_default = TRUE
  `);
  await seedDefaultTemplateIfEmpty('early_warning', buildDefaultTemplateConfig('early_warning'));
  await seedDefaultTemplateIfEmpty('scheduling', buildDefaultTemplateConfig('scheduling'));
}
