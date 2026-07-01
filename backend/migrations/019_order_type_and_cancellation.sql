-- 订单类型、取消件数、排单取消确认版本
ALTER TABLE styles ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) NOT NULL DEFAULT 'distribution';
ALTER TABLE styles ADD COLUMN IF NOT EXISTS cancelled_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE styles ADD COLUMN IF NOT EXISTS cancel_revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE styles ADD COLUMN IF NOT EXISTS scheduling_ack_revision INTEGER NOT NULL DEFAULT 0;

ALTER TABLE styles DROP CONSTRAINT IF EXISTS styles_order_type_check;
ALTER TABLE styles ADD CONSTRAINT styles_order_type_check
  CHECK (order_type IN ('distribution', 'processing'));

ALTER TABLE styles DROP CONSTRAINT IF EXISTS styles_cancelled_qty_check;
ALTER TABLE styles ADD CONSTRAINT styles_cancelled_qty_check
  CHECK (cancelled_quantity >= 0);

-- 关账是否计入加工（系统开关）
INSERT INTO settings (key, value) VALUES ('closing_include_processing', 'false')
ON CONFLICT (key) DO NOTHING;
