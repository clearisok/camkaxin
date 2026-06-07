-- 报价单主表增加款式图
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS style_image VARCHAR(500);
