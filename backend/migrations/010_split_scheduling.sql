-- 母单/子单拆分排单：parent_style_id + 排单备注
ALTER TABLE styles ADD COLUMN IF NOT EXISTS parent_style_id INTEGER REFERENCES styles(id) ON DELETE CASCADE;
ALTER TABLE styles ADD COLUMN IF NOT EXISTS scheduling_remarks TEXT;
CREATE INDEX IF NOT EXISTS idx_styles_parent_style_id ON styles(parent_style_id);
