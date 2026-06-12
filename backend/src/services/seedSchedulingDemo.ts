import { query } from '../config/database.js';
import { PRODUCTION_GROUP_IDS } from '../utils/schedulingZone.js';
import { scheduleStyle } from './scheduleStyle.js';

function randomInt(min: number, max: number, seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  const r = x - Math.floor(x);
  return Math.floor(r * (max - min + 1)) + min;
}

interface StyleSeedRow {
  id: number;
  quantity: number | null;
}

export interface SeedSchedulingDemoOptions {
  /** 仅处理待排单母单（默认 true） */
  waitOnly?: boolean;
  changedBy?: string;
}

/**
 * 测试种子：通过排单 API 创建子单排入生产组（非业务逻辑，仅脚本调用）
 */
export async function seedSchedulingDemoData(options: SeedSchedulingDemoOptions = {}) {
  const { waitOnly = true, changedBy = 'seed-scheduling-demo' } = options;

  const where = waitOnly
    ? "WHERE scheduling_zone = 'wait' AND parent_style_id IS NULL"
    : "WHERE parent_style_id IS NOT NULL OR (parent_style_id IS NULL AND scheduling_zone != 'wait')";
  const stylesRes = await query<{ id: string; quantity: number | null }>(
    `SELECT id, quantity FROM styles ${where} ORDER BY id`,
  );

  const styles: StyleSeedRow[] = stylesRes.rows.map((row) => ({
    id: Number(row.id),
    quantity: row.quantity != null ? Number(row.quantity) : null,
  }));

  const buckets = new Map<string, StyleSeedRow[]>();
  for (const g of PRODUCTION_GROUP_IDS) buckets.set(g, []);
  styles.forEach((style, index) => {
    const group = PRODUCTION_GROUP_IDS[index % PRODUCTION_GROUP_IDS.length];
    buckets.get(group)!.push(style);
  });

  let updated = 0;

  for (const [groupName, groupStyles] of buckets) {
    for (let i = 0; i < groupStyles.length; i++) {
      const style = groupStyles[i];
      const seed = style.id * 173 + i;
      const quantity = style.quantity ?? randomInt(2000, 12000, seed + 1);
      const requiredDays = randomInt(7, 28, seed);

      await scheduleStyle(
        style.id,
        {
          schedule_qty: quantity,
          required_days: requiredDays,
          is_outsourced: false,
          group_name: groupName,
        },
        changedBy,
      );
      updated++;
    }
  }

  return { updated, total: styles.length };
}
