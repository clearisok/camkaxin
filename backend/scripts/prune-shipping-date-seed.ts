/**
 * 种子数据清理：删除要求出货日不在 2026-04 ~ 2026-11 范围内的款式
 * 用法: npx tsx scripts/prune-shipping-date-seed.ts
 */
import dotenv from 'dotenv';
import { pool } from '../src/config/database.js';
import {
  pruneShippingDateSeed,
  SHIPPING_DATE_RANGE_END,
  SHIPPING_DATE_RANGE_START,
} from '../src/services/pruneShippingDateSeed.js';

dotenv.config();

async function main() {
  console.log(`清理要求出货日范围外的种子数据（保留 ${SHIPPING_DATE_RANGE_START} ~ ${SHIPPING_DATE_RANGE_END}）…`);
  const result = await pruneShippingDateSeed();
  if (result.samples.length > 0) {
    console.log('示例（最多 20 条）:');
    for (const row of result.samples) {
      console.log(`  #${row.id} ${row.style_number ?? '—'} 出货日=${row.required_shipping_date ?? '空'}`);
    }
  }
  console.log(`已删除 ${result.deleted} 条，剩余 ${result.kept} 条`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
