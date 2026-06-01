#!/usr/bin/env node
import React from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { createClient } from './client.js';
import { configPath } from './paths.js';
import { createConfig, maskSecret, readConfig, writeConfig } from './config.js';
import {
  createShare,
  directLinkUrl,
  disableDirectLink,
  enableDirectLink,
  listFiles,
  makeDirectory,
  uploadFile,
  downloadFile,
  type GlobalOptions
} from './commands.js';
import { printSuccess, runCommand } from './output.js';
import { App } from './tui/App.js';

function numberValue(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid number: ${value}`);
  return parsed;
}

function globalOptions(localOptions: Record<string, unknown> = {}): GlobalOptions {
  const options = {
    ...program.opts<{
      json?: boolean;
      authClientId?: string;
      authClientSecret?: string;
      baseUrl?: string;
    }>(),
    ...localOptions
  } as {
    json?: boolean;
    progressJson?: boolean;
    authClientId?: string;
    authClientSecret?: string;
    baseUrl?: string;
  };
  return {
    json: options.json,
    progressJson: options.progressJson,
    clientId: options.authClientId,
    clientSecret: options.authClientSecret,
    baseURL: options.baseUrl
  };
}

const program = new Command();

program
  .name('pan123')
  .description('123Pan CLI and TUI')
  .version('0.1.0')
  .option('--json', 'print stable JSON output')
  .option('--progress-json', 'print progress events as JSON Lines to stderr')
  .option('--auth-client-id <id>', 'temporarily override clientId')
  .option('--auth-client-secret <secret>', 'temporarily override clientSecret')
  .option('--base-url <url>', 'temporarily override API base URL')
  .action(() => {
    render(<App overrides={globalOptions()} />);
  });

program
  .command('init')
  .description('open the setup wizard')
  .action(() => {
    render(<App forceSetup overrides={globalOptions()} />);
  });

const configCommand = program.command('config').description('manage local config');

configCommand
  .command('path')
  .description('print config file path')
  .action(() => {
    printSuccess(configPath(), globalOptions());
  });

configCommand
  .command('show')
  .description('show config with masked secret')
  .action(options =>
    runCommand(async () => {
      const config = await readConfig(globalOptions(options));
      printSuccess({ ...config, clientSecret: maskSecret(config.clientSecret) }, globalOptions(options));
    }, globalOptions(options))
  );

configCommand
  .command('set')
  .description('write client credentials to config.json')
  .requiredOption('--client-id <id>', '123Pan client id')
  .requiredOption('--client-secret <secret>', '123Pan client secret')
  .option('--base-url <url>', 'API base URL')
  .option('--download-dir <path>', 'default download directory')
  .option('--default-parent-file-id <id>', 'default parent file id', numberValue)
  .action(options =>
    runCommand(async () => {
      const config = createConfig({
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        baseURL: options.baseUrl,
        defaultParentFileId: options.defaultParentFileId,
        downloadDir: options.downloadDir
      });
      await writeConfig(config);
      printSuccess({ path: configPath(), config: { ...config, clientSecret: maskSecret(config.clientSecret) } }, globalOptions(options));
    }, globalOptions(options))
  );

configCommand
  .command('test')
  .description('test current config with the 123Pan API')
  .action(options =>
    runCommand(async () => {
      const config = await readConfig(globalOptions(options));
      const user = await createClient(config).user.info();
      printSuccess(user, globalOptions(options));
    }, globalOptions(options))
  );

program
  .command('ls')
  .description('list files')
  .argument('[parentFileId]', 'parent file id', numberValue, 0)
  .option('--limit <n>', 'page size', numberValue, 100)
  .option('--search <text>', 'search keyword')
  .action((parentFileId, options) =>
    runCommand(() => listFiles(parentFileId, { ...globalOptions(options), limit: options.limit, search: options.search }), globalOptions(options))
  );

program
  .command('mkdir')
  .description('create directory')
  .argument('<name>', 'directory name')
  .requiredOption('--parent <fileId>', 'parent file id', numberValue)
  .action((name, options) =>
    runCommand(() => makeDirectory(name, options.parent, globalOptions(options)), globalOptions(options))
  );

program
  .command('upload')
  .description('upload a file')
  .argument('<path>', 'local file path')
  .option('--parent <fileId>', 'parent file id', numberValue)
  .option('--name <name>', 'remote filename')
  .option('--overwrite', 'overwrite duplicate remote file')
  .action((filePath, options) =>
    runCommand(
      () =>
        uploadFile(filePath, {
          ...globalOptions(options),
          parent: options.parent,
          name: options.name,
          overwrite: options.overwrite
        }),
      globalOptions(options)
    )
  );

program
  .command('download')
  .description('download a file')
  .argument('<fileId>', 'file id', numberValue)
  .option('--out <path>', 'output file path or directory')
  .action((fileId, options) =>
    runCommand(() => downloadFile(fileId, { ...globalOptions(options), out: options.out }), globalOptions(options))
  );

const shareCommand = program.command('share').description('manage shares');

shareCommand
  .command('create')
  .description('create normal share')
  .argument('<fileIds...>', 'file ids')
  .option('--name <name>', 'share name')
  .option('--expire <days>', '1, 7, 30, or 0', '7')
  .option('--pwd <code>', 'share password')
  .action((fileIds, options) =>
    runCommand(
      () =>
        createShare(fileIds, {
          ...globalOptions(options),
          name: options.name,
          expire: options.expire,
          pwd: options.pwd
        }),
      globalOptions(options)
    )
  );

const directLinkCommand = program.command('direct-link').description('manage direct links');

directLinkCommand
  .command('enable')
  .description('enable direct-link space for a folder')
  .argument('<folderId>', 'folder id', numberValue)
  .action((folderId, options) => runCommand(() => enableDirectLink(folderId, globalOptions(options)), globalOptions(options)));

directLinkCommand
  .command('disable')
  .description('disable direct-link space for a folder')
  .argument('<folderId>', 'folder id', numberValue)
  .action((folderId, options) => runCommand(() => disableDirectLink(folderId, globalOptions(options)), globalOptions(options)));

directLinkCommand
  .command('url')
  .description('get direct-link URL for a file')
  .argument('<fileId>', 'file id', numberValue)
  .action((fileId, options) => runCommand(() => directLinkUrl(fileId, globalOptions(options)), globalOptions(options)));

program.parseAsync(process.argv).catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
