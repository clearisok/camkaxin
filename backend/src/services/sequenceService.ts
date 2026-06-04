import { query, getClient } from '../config/database.js';
import { formatQuotationNo, formatItemNo } from '../utils/calculation.js';

/** 获取下一个报价单号 */
export async function nextQuotationNo(): Promise<string> {
  const today = new Date();
  const dateKey = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await client.query<{ current_value: number; date_key: string }>(
      'SELECT current_value, date_key FROM sequences WHERE name = $1 FOR UPDATE',
      ['quotation']
    );

    let seq = 1;
    if (result.rows.length === 0) {
      await client.query(
        'INSERT INTO sequences (name, current_value, date_key, prefix) VALUES ($1, 1, $2, $3)',
        ['quotation', 1, dateKey, 'Q']
      );
    } else {
      const row = result.rows[0];
      if (row.date_key === dateKey) {
        seq = row.current_value + 1;
      }
      await client.query(
        'UPDATE sequences SET current_value = $1, date_key = $2 WHERE name = $3',
        [seq, dateKey, 'quotation']
      );
    }
    await client.query('COMMIT');
    return formatQuotationNo(today, seq);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** 获取下一个明细行号 */
export async function nextItemNo(): Promise<string> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await client.query<{ current_value: number }>(
      'SELECT current_value FROM sequences WHERE name = $1 FOR UPDATE',
      ['quotation_item']
    );

    let seq = 1;
    if (result.rows.length === 0) {
      await client.query(
        'INSERT INTO sequences (name, current_value, prefix) VALUES ($1, 1, $2)',
        ['quotation_item', 1, 'MX']
      );
    } else {
      seq = result.rows[0].current_value + 1;
      await client.query(
        'UPDATE sequences SET current_value = $1 WHERE name = $2',
        [seq, 'quotation_item']
      );
    }
    await client.query('COMMIT');
    return formatItemNo(seq);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** 更新品牌使用记录 */
export async function trackBrandUsage(brandId: number) {
  await query(
    `UPDATE brands SET use_count = use_count + 1, last_used_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [brandId]
  );
}

/** 更新面料使用记录 */
export async function trackFabricUsage(fabricId: number) {
  await query(
    `UPDATE fabric_library SET use_count = use_count + 1, last_used_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [fabricId]
  );
}

/** 更新辅料使用记录 */
export async function trackAccessoryUsage(accessoryId: number) {
  await query(
    `UPDATE accessory_library SET use_count = use_count + 1, last_used_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [accessoryId]
  );
}

/** 获取全局汇率 */
export async function getExchangeRate(): Promise<number> {
  const result = await query<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'usd_to_rmb_rate'"
  );
  return parseFloat(result.rows[0]?.value || '6.8');
}
