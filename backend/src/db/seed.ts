import { pool, query } from '../config/database.js';

async function seed() {
  console.log('Seeding database...');

  // 全局汇率
  await query(
    `INSERT INTO settings (key, value) VALUES ('usd_to_rmb_rate', '6.8000')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
  );

  // 业务员
  const agents = await query<{ id: number }>(
    `INSERT INTO agents (name) VALUES
      ('张三'), ('李四'), ('王五')
     ON CONFLICT DO NOTHING
     RETURNING id`
  );

  let agentIds = agents.rows.map((r) => r.id);
  if (agentIds.length === 0) {
    const existing = await query<{ id: number }>('SELECT id FROM agents ORDER BY id');
    agentIds = existing.rows.map((r) => r.id);
  }

  // 品牌
  if (agentIds.length >= 3) {
    await query(
      `INSERT INTO brands (name, agent_id) VALUES
        ('ZARA', $1), ('H&M', $2), ('UNIQLO', $3), ('GAP', $1), ('Mango', $2)
       ON CONFLICT (name) DO NOTHING`,
      [agentIds[0], agentIds[1], agentIds[2]]
    );
  }

  // 面料库
  await query(
    `INSERT INTO fabric_library (name, composition, weight, net_width, unit, reference_price) VALUES
      ('全棉斜纹', '100% Cotton', 200, 150, 'meter', 28.50),
      ('涤棉混纺', '65% Polyester 35% Cotton', 180, 145, 'meter', 22.00),
      ('针织汗布', '95% Cotton 5% Spandex', 180, 160, 'kg', 45.00),
      ('牛仔布', '98% Cotton 2% Spandex', 320, 148, 'meter', 35.00),
      ('雪纺', '100% Polyester', 75, 140, 'meter', 18.00)
     ON CONFLICT DO NOTHING`
  );

  // 辅料库
  await query(
    `INSERT INTO accessory_library (name, reference_price) VALUES
      ('主唛', 0.50), ('洗水唛', 0.30), ('吊牌', 0.80),
      ('纽扣(四眼)', 0.15), ('拉链(YKK)', 2.50),
      ('缝纫线', 0.20), ('包装袋', 0.60), ('纸箱', 1.20)
     ON CONFLICT DO NOTHING`
  );

  // 品牌基础辅料
  const brands = await query<{ id: number; name: string }>(
    "SELECT id, name FROM brands WHERE name = 'ZARA'"
  );
  if (brands.rows[0]) {
    const brandId = brands.rows[0].id;
    await query(
      `INSERT INTO brand_default_accessories (brand_id, name, consumption, wastage, unit_price, sort_order) VALUES
        ($1, '主唛', 1, 5, 0.50, 1),
        ($1, '洗水唛', 1, 5, 0.30, 2),
        ($1, '吊牌', 1, 5, 0.80, 3),
        ($1, '包装袋', 1, 5, 0.60, 4)
       ON CONFLICT DO NOTHING`,
      [brandId]
    );
  }

  // 初始化序号
  await query(
    `INSERT INTO sequences (name, current_value, prefix) VALUES
      ('quotation_item', 0, 'MX'),
      ('quotation', 0, 'Q')
     ON CONFLICT (name) DO NOTHING`
  );

  console.log('Seed data inserted successfully.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Failed to seed database:', err);
  process.exit(1);
});
