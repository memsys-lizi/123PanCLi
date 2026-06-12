import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { appDir, configPath, expandHome, fileCachePath, logPath, tasksPath } from './paths.js';

export const DEFAULT_BASE_URL = 'https://open-api.123pan.com';
export const DEFAULT_DOWNLOAD_DIR = '~/Downloads/123pan';

export const ConfigSchema = z.object({
  version: z.literal(1).default(1),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  baseURL: z.string().url().default(DEFAULT_BASE_URL),
  defaultParentFileId: z.coerce.number().int().nonnegative().default(0),
  downloadDir: z.string().min(1).default(DEFAULT_DOWNLOAD_DIR),
  requestTimeout: z.coerce.number().int().positive().default(300000), // 5 minutes
  uploadTimeout: z.coerce.number().int().positive().default(1200000), // 20 minutes
  downloadTimeout: z.coerce.number().int().positive().default(1200000) // 20 minutes
});

export type Pan123CliConfig = z.infer<typeof ConfigSchema>;

export interface ConfigOverrides {
  clientId?: string;
  clientSecret?: string;
  baseURL?: string;
}

export class ConfigMissingError extends Error {
  constructor() {
    super(`Missing config file: ${configPath()}`);
    this.name = 'ConfigMissingError';
  }
}

export class ConfigInvalidError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid config file: ${issues.join('; ')}`);
    this.name = 'ConfigInvalidError';
    this.issues = issues;
  }
}

export async function ensureAppDirs(): Promise<void> {
  await mkdir(appDir(), { recursive: true });
  await mkdir(path.dirname(fileCachePath()), { recursive: true });
  await mkdir(path.dirname(logPath()), { recursive: true });
}

export async function ensureDataFiles(): Promise<void> {
  await ensureAppDirs();
  await ensureJsonFile(tasksPath(), []);
  await ensureJsonFile(fileCachePath(), { directories: {} });
}

async function ensureJsonFile(filePath: string, value: unknown): Promise<void> {
  try {
    await readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  }
}

export async function readRawConfig(): Promise<unknown> {
  try {
    return JSON.parse(await readFile(configPath(), 'utf8')) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ConfigMissingError();
    }
    throw error;
  }
}

export async function readConfig(overrides: ConfigOverrides = {}): Promise<Pan123CliConfig> {
  const raw = await readRawConfig();
  const merged = {
    ...(raw && typeof raw === 'object' ? raw : {}),
    clientId: overrides.clientId ?? process.env.PAN123_CLIENT_ID ?? (raw as { clientId?: string })?.clientId,
    clientSecret:
      overrides.clientSecret ?? process.env.PAN123_CLIENT_SECRET ?? (raw as { clientSecret?: string })?.clientSecret,
    baseURL: overrides.baseURL ?? (raw as { baseURL?: string })?.baseURL
  };
  const parsed = ConfigSchema.safeParse(merged);
  if (!parsed.success) {
    throw new ConfigInvalidError(parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`));
  }
  return parsed.data;
}

export async function writeConfig(config: Pan123CliConfig): Promise<void> {
  await ensureDataFiles();
  const parsed = ConfigSchema.parse(config);
  await writeFile(configPath(), `${JSON.stringify(parsed, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
}

export function maskSecret(secret: string): string {
  if (secret.length <= 8) return '*'.repeat(secret.length);
  return `${secret.slice(0, 4)}${'*'.repeat(Math.max(4, secret.length - 8))}${secret.slice(-4)}`;
}

export function resolveDownloadDir(config: Pan123CliConfig): string {
  return expandHome(config.downloadDir);
}

export function createConfig(input: {
  clientId: string;
  clientSecret: string;
  baseURL?: string;
  defaultParentFileId?: number;
  downloadDir?: string;
}): Pan123CliConfig {
  return ConfigSchema.parse({
    version: 1,
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    baseURL: input.baseURL ?? DEFAULT_BASE_URL,
    defaultParentFileId: input.defaultParentFileId ?? 0,
    downloadDir: input.downloadDir ?? DEFAULT_DOWNLOAD_DIR
  });
}
