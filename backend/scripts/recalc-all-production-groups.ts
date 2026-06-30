/**
 * 按 required_days 重算全部生产组上下线（保留各组首单上线日）
 * 用法: npx tsx scripts/recalc-all-production-groups.ts
 */
import dotenv from 'dotenv';
import { pool } from '../src/config/database.js';
import { recalcAllProductionGroupsAfterCalendarChange } from '../src/services/schedulingCalendarSync.js';

dotenv.config();

async function main() {
  const result = await recalcAllProductionGroupsAfterCalendarChange('enforce-required-days');
  console.log(`完成：已重算 ${result.groupsRecalculated} 个生产组（required_days 为准）`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
