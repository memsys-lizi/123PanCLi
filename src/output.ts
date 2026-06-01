import { normalizeError } from './client.js';

export interface OutputOptions {
  json?: boolean;
  progressJson?: boolean;
}

export function printProgress(event: Record<string, unknown>, options: OutputOptions = {}): void {
  if (options.progressJson) {
    process.stderr.write(`${JSON.stringify({ ok: true, type: 'progress', ...event })}\n`);
  }
}

export function printSuccess(data: unknown, options: OutputOptions = {}): void {
  if (options.json) {
    console.log(JSON.stringify({ ok: true, data }, null, 2));
    return;
  }
  if (typeof data === 'string') {
    console.log(data);
    return;
  }
  console.log(JSON.stringify(data, null, 2));
}

export function printError(error: unknown, options: OutputOptions = {}): void {
  const normalized = normalizeError(error);
  if (options.json) {
    console.error(JSON.stringify({ ok: false, error: normalized }, null, 2));
    return;
  }
  const trace = normalized.traceId ? ` traceId=${normalized.traceId}` : '';
  const code = normalized.code ? ` code=${normalized.code}` : '';
  console.error(`Error:${code}${trace} ${normalized.message}`);
}

export async function runCommand(action: () => Promise<void>, options: OutputOptions = {}): Promise<void> {
  try {
    await action();
  } catch (error) {
    printError(error, options);
    process.exitCode = 1;
  }
}
