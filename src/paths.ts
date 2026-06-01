import os from 'node:os';
import path from 'node:path';

export const APP_DIR_NAME = '.123pancli';

export function appDir(): string {
  if (process.env.PAN123CLI_HOME) return process.env.PAN123CLI_HOME;
  return path.join(os.homedir(), APP_DIR_NAME);
}

export function configPath(): string {
  return path.join(appDir(), 'config.json');
}

export function tasksPath(): string {
  return path.join(appDir(), 'tasks.json');
}

export function fileCachePath(): string {
  return path.join(appDir(), 'cache', 'files.json');
}

export function logPath(): string {
  return path.join(appDir(), 'logs', 'pan123.log');
}

export function expandHome(input: string): string {
  if (input === '~') return os.homedir();
  if (input.startsWith(`~${path.sep}`) || input.startsWith('~/')) {
    return path.join(os.homedir(), input.slice(2));
  }
  return input;
}
