/**
 * 为预警视图中的款式随机补全未填字段
 * 用法: npx tsx scripts/fill-early-warning-gaps.ts
 */
import dotenv from 'dotenv';
import { pool } from '../src/config/database.js';
import { fillEarlyWarningGaps } from '../src/services/fillEarlyWarningGaps.js';

dotenv.config();

async function main() {
  const result = await fillEarlyWarningGaps('fill-early-warning-gaps-cli');
  console.log(`完成：已更新 ${result.updated} 条款式，补全 ${result.fieldsFilled} 个字段`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
