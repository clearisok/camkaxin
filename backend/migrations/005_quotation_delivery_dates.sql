-- 有效期至 → 成衣交期，新增面料交期
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotations' AND column_name = 'valid_until'
  ) THEN
    ALTER TABLE quotations RENAME COLUMN valid_until TO garment_delivery_date;
  END IF;
END $$;

ALTER TABLE quotations ADD COLUMN IF NOT EXISTS fabric_delivery_date DATE;
