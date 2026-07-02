-- 业务员归属单一品牌：agents.brand_id（一对多：品牌 -> 业务员）
-- 若 brand_agents 不存在（db:init 后）则跳过数据迁移

ALTER TABLE agents ADD COLUMN IF NOT EXISTS brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'brand_agents'
  ) THEN
    UPDATE agents a
    SET brand_id = sub.brand_id
    FROM (
      SELECT DISTINCT ON (agent_id) agent_id, brand_id
      FROM brand_agents
      ORDER BY agent_id, brand_id
    ) sub
    WHERE a.id = sub.agent_id;
  END IF;
END $$;

DROP TABLE IF EXISTS brand_agents;

CREATE INDEX IF NOT EXISTS idx_agents_brand_id ON agents(brand_id);

COMMENT ON COLUMN agents.brand_id IS '业务员所属品牌（每个业务员仅归属一个品牌）';
