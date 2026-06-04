-- 柬凯报价模块数据库 Schema

-- 业务员
CREATE TABLE IF NOT EXISTS agents (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 品牌
CREATE TABLE IF NOT EXISTS brands (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  last_used_at TIMESTAMPTZ,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 面料库
CREATE TABLE IF NOT EXISTS fabric_library (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  composition VARCHAR(500),
  weight DECIMAL(10,2),
  net_width DECIMAL(10,2),
  unit VARCHAR(10) DEFAULT 'meter' CHECK (unit IN ('meter', 'kg')),
  reference_price DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  last_used_at TIMESTAMPTZ,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 辅料库
CREATE TABLE IF NOT EXISTS accessory_library (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  reference_price DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  last_used_at TIMESTAMPTZ,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 品牌基础辅料
CREATE TABLE IF NOT EXISTS brand_default_accessories (
  id SERIAL PRIMARY KEY,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  consumption DECIMAL(10,2) DEFAULT 1,
  wastage INTEGER DEFAULT 5,
  unit_price DECIMAL(10,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 全局设置
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Excel 模板
CREATE TABLE IF NOT EXISTS excel_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 报价单主表
CREATE TABLE IF NOT EXISTS quotations (
  id SERIAL PRIMARY KEY,
  quotation_no VARCHAR(20) NOT NULL UNIQUE,
  brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
  agent_name VARCHAR(100),
  currency VARCHAR(10) DEFAULT 'RMB' CHECK (currency IN ('RMB', 'USD')),
  exchange_rate DECIMAL(10,4) DEFAULT 6.8000,
  quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  profit_margin INTEGER DEFAULT 5,
  remarks TEXT,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'confirmed', 'expired')),
  created_by VARCHAR(100) DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by VARCHAR(100) DEFAULT 'system',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 报价明细行
CREATE TABLE IF NOT EXISTS quotation_items (
  id SERIAL PRIMARY KEY,
  quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  item_no VARCHAR(20) NOT NULL,
  product_code VARCHAR(100),
  version_label VARCHAR(100),
  style_image VARCHAR(500),
  delivery_date TEXT,
  quantity INTEGER DEFAULT 0,
  description TEXT,
  labor_cost_usd DECIMAL(10,2) DEFAULT 0,
  other_cost_rmb DECIMAL(10,2) DEFAULT 0,
  shipping_rmb DECIMAL(10,2) DEFAULT 1.00,
  fabric_total DECIMAL(10,2) DEFAULT 0,
  accessory_total DECIMAL(10,2) DEFAULT 0,
  labor_rmb DECIMAL(10,2) DEFAULT 0,
  subtotal_rmb DECIMAL(10,2) DEFAULT 0,
  final_price DECIMAL(10,2) DEFAULT 0,
  version INTEGER DEFAULT 1,
  is_current BOOLEAN DEFAULT TRUE,
  sample_images JSONB DEFAULT '[]',
  sample_videos JSONB DEFAULT '[]',
  pattern_files JSONB DEFAULT '[]',
  layout_files JSONB DEFAULT '[]',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 面料明细
CREATE TABLE IF NOT EXISTS item_fabrics (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES quotation_items(id) ON DELETE CASCADE,
  fabric_id INTEGER REFERENCES fabric_library(id) ON DELETE SET NULL,
  name VARCHAR(200),
  composition VARCHAR(500),
  weight DECIMAL(10,2),
  net_width DECIMAL(10,2),
  gross_width DECIMAL(10,2),
  unit VARCHAR(10) DEFAULT 'meter' CHECK (unit IN ('meter', 'kg')),
  piece_length DECIMAL(10,2) DEFAULT 0,
  wastage INTEGER DEFAULT 5,
  consumption DECIMAL(10,2) DEFAULT 0,
  unit_price DECIMAL(10,2) DEFAULT 0,
  amount DECIMAL(10,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 辅料明细
CREATE TABLE IF NOT EXISTS item_accessories (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES quotation_items(id) ON DELETE CASCADE,
  accessory_id INTEGER REFERENCES accessory_library(id) ON DELETE SET NULL,
  name VARCHAR(200),
  consumption DECIMAL(10,2) DEFAULT 1,
  wastage INTEGER DEFAULT 5,
  unit_price DECIMAL(10,2) DEFAULT 0,
  amount DECIMAL(10,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 数量阶梯
CREATE TABLE IF NOT EXISTS item_quantity_tiers (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES quotation_items(id) ON DELETE CASCADE,
  min_qty INTEGER NOT NULL DEFAULT 0,
  max_qty INTEGER,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 版本快照
CREATE TABLE IF NOT EXISTS item_version_snapshots (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES quotation_items(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  data JSONB NOT NULL,
  update_note TEXT,
  created_by VARCHAR(100) DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 序号表
CREATE TABLE IF NOT EXISTS sequences (
  name VARCHAR(50) PRIMARY KEY,
  current_value INTEGER DEFAULT 0,
  prefix VARCHAR(20),
  date_key VARCHAR(20)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_brands_last_used ON brands(last_used_at DESC NULLS LAST, use_count DESC);
CREATE INDEX IF NOT EXISTS idx_fabric_last_used ON fabric_library(last_used_at DESC NULLS LAST, use_count DESC);
CREATE INDEX IF NOT EXISTS idx_accessory_last_used ON accessory_library(last_used_at DESC NULLS LAST, use_count DESC);
CREATE INDEX IF NOT EXISTS idx_quotations_brand ON quotations(brand_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_item_fabrics_item ON item_fabrics(item_id);
CREATE INDEX IF NOT EXISTS idx_item_accessories_item ON item_accessories(item_id);
