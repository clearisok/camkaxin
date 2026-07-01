import { query } from '../config/database.js';

export async function ensureSchedulingSchema() {
  await query(`ALTER TABLE styles ADD COLUMN IF NOT EXISTS scheduling_zone VARCHAR(20) DEFAULT 'wait'`);
  await query('ALTER TABLE styles ADD COLUMN IF NOT EXISTS sort_order INTEGER');
  await query('ALTER TABLE styles ADD COLUMN IF NOT EXISTS required_days INTEGER');
  await query('ALTER TABLE styles ADD COLUMN IF NOT EXISTS parent_style_id INTEGER REFERENCES styles(id) ON DELETE CASCADE');
  await query('ALTER TABLE styles ADD COLUMN IF NOT EXISTS scheduling_remarks TEXT');
  await query('CREATE INDEX IF NOT EXISTS idx_styles_scheduling_zone ON styles(scheduling_zone)');
  await query('CREATE INDEX IF NOT EXISTS idx_styles_zone_group_sort ON styles(scheduling_zone, group_name, sort_order)');
  await query('CREATE INDEX IF NOT EXISTS idx_styles_parent_style_id ON styles(parent_style_id)');
  await query(`ALTER TABLE styles ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) NOT NULL DEFAULT 'distribution'`);
  await query('ALTER TABLE styles ADD COLUMN IF NOT EXISTS cancelled_quantity INTEGER NOT NULL DEFAULT 0');
  await query('ALTER TABLE styles ADD COLUMN IF NOT EXISTS cancel_revision INTEGER NOT NULL DEFAULT 0');
  await query('ALTER TABLE styles ADD COLUMN IF NOT EXISTS scheduling_ack_revision INTEGER NOT NULL DEFAULT 0');
}
