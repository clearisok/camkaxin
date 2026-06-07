import fs from 'fs';
import path from 'path';

const LOG_FILE = path.resolve('d:/workspace/.cursor/debug-6f51ef.log');

/** Debug session logging (agent instrumentation) */
export function debugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string
) {
  const entry = {
    sessionId: '6f51ef',
    location,
    message,
    data,
    hypothesisId,
    timestamp: Date.now(),
    runId: 'pre-fix',
  };
  // #region agent log
  try {
    fs.appendFileSync(LOG_FILE, `${JSON.stringify(entry)}\n`);
  } catch { /* ignore */ }
  fetch('http://127.0.0.1:7866/ingest/949bb3a4-1e98-433b-8c2f-5ab46646876f', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6f51ef' },
    body: JSON.stringify(entry),
  }).catch(() => {});
  // #endregion
}
