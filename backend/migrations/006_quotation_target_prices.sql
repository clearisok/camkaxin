ALTER TABLE quotations ADD COLUMN IF NOT EXISTS target_labor_price DECIMAL(10,2);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS target_garment_price DECIMAL(10,2);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS confirmed_labor_price DECIMAL(10,2);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS confirmed_garment_price DECIMAL(10,2);
