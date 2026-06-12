-- 排单时填写的所需天数（预警视图只读展示）
ALTER TABLE styles ADD COLUMN IF NOT EXISTS required_days INTEGER;
