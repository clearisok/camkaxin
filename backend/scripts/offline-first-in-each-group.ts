/**
 * 一次性操作：将每个生产组的第一个订单下线
 * 用法: npx tsx scripts/offline-first-in-each-group.ts
 */
import dotenv from 'dotenv';
import { pool } from '../src/config/database.js';
import { offlineStyle } from '../src/services/schedulingOperations.js';

dotenv.config();

async function main() {
  const res = await pool.query<{ id: number; group_name: string; sort_order: number | null; style_number: string | null }>(
    `SELECT DISTINCT ON (group_name) id, group_name, sort_order, style_number
     FROM styles
     WHERE scheduling_zone = 'group' AND group_name IS NOT NULL
     ORDER BY group_name, sort_order ASC NULLS LAST, id ASC`,
  );

  if (res.rows.length === 0) {
    console.log('没有可下线的生产组首单');
    await pool.end();
    return;
  }

  console.log(`共 ${res.rows.length} 个组，准备下线首单：`);
  for (const row of res.rows) {
    console.log(`  第 ${row.group_name} 组 — id=${row.id} 款号=${row.style_number ?? '—'}`);
  }

  const results: Array<{ id: number; group: string; ok: boolean; error?: string }> = [];
  for (const row of res.rows) {
    try {
      await offlineStyle(row.id, 'offline-first-in-each-group');
      results.push({ id: row.id, group: row.group_name, ok: true });
      console.log(`✓ 第 ${row.group_name} 组 id=${row.id} 已下线`);
    } catch (e) {
      const msg = String(e);
      results.push({ id: row.id, group: row.group_name, ok: false, error: msg });
      console.error(`✗ 第 ${row.group_name} 组 id=${row.id} 失败: ${msg}`);
    }
  }

  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  console.log(`\n完成：成功 ${ok}，失败 ${fail}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
