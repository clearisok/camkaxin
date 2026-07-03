-- 品牌-业务员多对多关联

CREATE TABLE IF NOT EXISTS brand_agents (
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (brand_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_brand_agents_agent_id ON brand_agents(agent_id);

-- 迁移旧数据 brands.agent_id -> brand_agents（仅旧库存在 agent_id 列时执行）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'brands' AND column_name = 'agent_id'
  ) THEN
    INSERT INTO brand_agents (brand_id, agent_id)
    SELECT id, agent_id FROM brands WHERE agent_id IS NOT NULL
    ON CONFLICT (brand_id, agent_id) DO NOTHING;
  END IF;
END $$;

ALTER TABLE brands DROP COLUMN IF EXISTS agent_id;

COMMENT ON TABLE brand_agents IS 'Brand-agent many-to-many mapping';
