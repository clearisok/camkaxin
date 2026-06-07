-- Migration 001: 业务员默认损耗、面料默认损耗、辅料规格
-- 运行: psql $DATABASE_URL -f migrations/001_add_wastage_and_spec.sql

ALTER TABLE agents ADD COLUMN IF NOT EXISTS default_wastage INTEGER DEFAULT 5;

ALTER TABLE fabric_library ADD COLUMN IF NOT EXISTS default_wastage INTEGER DEFAULT 5;

ALTER TABLE accessory_library ADD COLUMN IF NOT EXISTS specification VARCHAR(500);

ALTER TABLE item_accessories ADD COLUMN IF NOT EXISTS specification VARCHAR(500);

COMMENT ON COLUMN agents.default_wastage IS '业务员默认面料/辅料损耗百分比';
COMMENT ON COLUMN fabric_library.default_wastage IS '面料默认损耗百分比';
COMMENT ON COLUMN accessory_library.specification IS '辅料规格型号';
