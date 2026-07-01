import { query } from '../config/database.js';
import { getExchangeRate } from './sequenceService.js';

export async function getSetting(key: string, fallback = ''): Promise<string> {
  const res = await query<{ value: string }>(
    'SELECT value FROM settings WHERE key = $1',
    [key],
  );
  return res.rows[0]?.value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, value],
  );
}

export async function getClosingIncludeProcessing(): Promise<boolean> {
  const v = await getSetting('closing_include_processing', 'false');
  return v === 'true' || v === '1';
}

export async function setClosingIncludeProcessing(include: boolean): Promise<void> {
  await setSetting('closing_include_processing', include ? 'true' : 'false');
}

export async function getClosingSettings(): Promise<{
  exchange_rate: number;
  closing_include_processing: boolean;
}> {
  const [exchange_rate, closing_include_processing] = await Promise.all([
    getExchangeRate(),
    getClosingIncludeProcessing(),
  ]);
  return { exchange_rate, closing_include_processing };
}
