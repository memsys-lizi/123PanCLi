import { appendFile } from 'node:fs/promises';
import { ensureAppDirs } from './config.js';
import { logPath } from './paths.js';

export async function logEvent(type: string, payload: unknown): Promise<void> {
  await ensureAppDirs();
  const line = JSON.stringify({
    time: new Date().toISOString(),
    type,
    payload
  });
  await appendFile(logPath(), `${line}\n`, 'utf8');
}
