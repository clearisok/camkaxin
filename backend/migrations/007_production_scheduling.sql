-- 预警排单：款式表 & 变更历史
CREATE TABLE IF NOT EXISTS styles (
  id SERIAL PRIMARY KEY,
  salesperson VARCHAR(100),
  brand VARCHAR(200),
  style_number VARCHAR(100),
  style_name VARCHAR(200),
  closing_month VARCHAR(7),
  style_image VARCHAR(500),
  fabric_structure VARCHAR(200),
  fabric_readiness VARCHAR(100),
  accessories_readiness VARCHAR(100),
  sample_progress VARCHAR(100),
  first_bed_time DATE,
  po_number VARCHAR(100),
  online_time DATE,
  offline_time DATE,
  scheduled_output INTEGER,
  avg_daily_output INTEGER,
  group_name VARCHAR(100),
  short_over_shipment VARCHAR(100),
  quantity INTEGER DEFAULT 0,
  processing_unit_price DECIMAL(12,2),
  sales_price DECIMAL(12,2),
  printing_embroidery VARCHAR(200),
  order_follower VARCHAR(100),
  required_shipping_date DATE,
  remarks TEXT,
  is_outsourced BOOLEAN DEFAULT FALSE,
  outsourced_factory VARCHAR(200),
  overseas_merchandiser VARCHAR(100),
  outsourced_price DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS style_histories (
  id SERIAL PRIMARY KEY,
  style_id INTEGER NOT NULL REFERENCES styles(id) ON DELETE CASCADE,
  changed_data JSONB NOT NULL DEFAULT '{}',
  changed_by VARCHAR(100) DEFAULT 'system',
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_styles_closing_month ON styles(closing_month);
CREATE INDEX IF NOT EXISTS idx_styles_group_name ON styles(group_name);
CREATE INDEX IF NOT EXISTS idx_styles_online_time ON styles(online_time);
CREATE INDEX IF NOT EXISTS idx_style_histories_style_id ON style_histories(style_id);
