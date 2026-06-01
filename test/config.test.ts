import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configPath } from '../src/paths.js';
import { createConfig, maskSecret, readConfig, writeConfig } from '../src/config.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'pan123cli-'));
  process.env.PAN123CLI_HOME = tempDir;
  delete process.env.PAN123_CLIENT_ID;
  delete process.env.PAN123_CLIENT_SECRET;
});

afterEach(async () => {
  delete process.env.PAN123CLI_HOME;
  delete process.env.PAN123_CLIENT_ID;
  delete process.env.PAN123_CLIENT_SECRET;
  await rm(tempDir, { recursive: true, force: true });
});

describe('config', () => {
  it('writes and reads config.json from the app directory', async () => {
    const config = createConfig({ clientId: 'client', clientSecret: 'secret-123456' });
    await writeConfig(config);

    await expect(readConfig()).resolves.toMatchObject({
      clientId: 'client',
      clientSecret: 'secret-123456',
      defaultParentFileId: 0
    });
    expect(configPath()).toBe(path.join(tempDir, 'config.json'));
  });

  it('uses environment credentials as temporary overrides without changing config', async () => {
    await writeConfig(createConfig({ clientId: 'file-client', clientSecret: 'file-secret' }));
    process.env.PAN123_CLIENT_ID = 'env-client';
    process.env.PAN123_CLIENT_SECRET = 'env-secret';

    await expect(readConfig()).resolves.toMatchObject({
      clientId: 'env-client',
      clientSecret: 'env-secret'
    });
  });

  it('masks long secrets for display', () => {
    expect(maskSecret('abcdefghijkl')).toBe('abcd****ijkl');
  });
});
