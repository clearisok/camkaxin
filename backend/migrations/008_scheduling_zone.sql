-- 排单区位 + 组内排序
ALTER TABLE styles ADD COLUMN IF NOT EXISTS scheduling_zone VARCHAR(20) DEFAULT 'wait';
ALTER TABLE styles ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- 从旧 group_name 迁移 scheduling_zone
UPDATE styles SET scheduling_zone = 'outsource', group_name = NULL
WHERE group_name = '外发' AND (scheduling_zone IS NULL OR scheduling_zone = 'wait');

UPDATE styles SET scheduling_zone = 'group'
WHERE group_name IS NOT NULL AND group_name <> ''
  AND group_name <> '外发'
  AND (scheduling_zone IS NULL OR scheduling_zone = 'wait');

UPDATE styles SET scheduling_zone = 'wait', group_name = NULL
WHERE (group_name IS NULL OR group_name = '')
  AND scheduling_zone IS NULL;

CREATE INDEX IF NOT EXISTS idx_styles_scheduling_zone ON styles(scheduling_zone);
CREATE INDEX IF NOT EXISTS idx_styles_zone_group_sort ON styles(scheduling_zone, group_name, sort_order);
