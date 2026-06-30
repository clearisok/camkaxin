import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SESSION_ID = 'd04cd5';
const INGEST = 'http://127.0.0.1:7669/ingest/daa40a17-44e4-44ed-a06e-87b0a593d701';
const LOG_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../debug-d04cd5.log');

export function agentDebugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  runId = 'pre-fix',
) {
  const entry = {
    sessionId: SESSION_ID,
    location,
    message,
    data,
    hypothesisId,
    timestamp: Date.now(),
    runId,
  };
  // #region agent log
  try {
    fs.appendFileSync(LOG_FILE, `${JSON.stringify(entry)}\n`);
  } catch { /* ignore */ }
  fetch(INGEST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': SESSION_ID },
    body: JSON.stringify(entry),
  }).catch(() => {});
  // #endregion
}
