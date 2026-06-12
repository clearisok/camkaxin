/**
 * 排单视图测试种子：轮询排入生产组（1–13、15、16），组内按「上款下线+1天=下款上线」串联日期
 * 用法:
 *   npx tsx scripts/seed-scheduling-demo.ts          # 仅待排单款式
 *   npx tsx scripts/seed-scheduling-demo.ts --all    # 全部款式（重排已有数据时用）
 */
import dotenv from 'dotenv';
import { pool } from '../src/config/database.js';
import { seedSchedulingDemoData } from '../src/services/seedSchedulingDemo.js';

dotenv.config();

async function main() {
  const waitOnly = !process.argv.includes('--all');
  const result = await seedSchedulingDemoData({ waitOnly });
  const scope = waitOnly ? '待排单' : '全部';
  console.log(`完成（${scope}）：已随机排入生产组 ${result.updated} / ${result.total} 条`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
