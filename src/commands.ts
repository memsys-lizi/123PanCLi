import path from 'node:path';
import { createClient } from './client.js';
import { readConfig, resolveDownloadDir, type ConfigOverrides } from './config.js';
import { downloadToFile, resolveDownloadOutput } from './download.js';
import { printProgress, printSuccess, type OutputOptions } from './output.js';
import { addTask } from './tasks.js';

export interface GlobalOptions extends ConfigOverrides, OutputOptions {}

export async function listFiles(
  parentFileId: number,
  options: GlobalOptions & { limit?: number; search?: string }
): Promise<void> {
  const config = await readConfig(options);
  const client = createClient(config);
  const data = await client.files.list({
    parentFileId,
    limit: options.limit ?? 100,
    searchData: options.search
  });
  const visibleFiles = data.fileList.filter(file => file.trashed !== 1);
  printSuccess({ ...data, fileList: visibleFiles }, options);
}

export async function makeDirectory(name: string, parent: number, options: GlobalOptions): Promise<void> {
  const config = await readConfig(options);
  const client = createClient(config);
  const data = await client.files.mkdir({ name, parentID: parent });
  await addTask({ type: 'mkdir', status: 'success', title: `创建目录 ${name}`, data });
  printSuccess(data, options);
}

export async function uploadFile(
  filePath: string,
  options: GlobalOptions & { parent?: number; name?: string; overwrite?: boolean }
): Promise<void> {
  const config = await readConfig(options);
  const client = createClient(config);
  const result = await client.upload.uploadFile({
    filePath,
    parentFileID: options.parent ?? config.defaultParentFileId,
    filename: options.name,
    duplicate: options.overwrite ? 2 : 1,
    onProgress: event => {
      printProgress({ command: 'upload', ...event }, options);
      if (!options.json && !options.progressJson) {
        process.stderr.write(`\r上传阶段 ${event.stage} ${event.percent.toFixed(1)}%`);
      }
    }
  });
  if (!options.json && !options.progressJson) process.stderr.write('\n');
  await addTask({ type: 'upload', status: 'success', title: `上传 ${path.basename(filePath)}`, data: result });
  printSuccess(result, options);
}

export async function downloadFile(fileId: number, options: GlobalOptions & { out?: string }): Promise<void> {
  const config = await readConfig(options);
  const client = createClient(config);
  const detail = (await client.files.detail({ fileID: fileId })) as { filename?: string };
  const info = await client.files.downloadInfo({ fileId });
  const outputPath = await resolveDownloadOutput({
    out: options.out,
    downloadDir: resolveDownloadDir(config),
    filename: detail.filename,
    fileId
  });
  const result = await downloadToFile(info.downloadUrl, outputPath, event => {
    printProgress({ command: 'download', ...event }, options);
    if (!options.json && !options.progressJson) {
      const percent = event.percent === undefined ? `${event.loadedBytes} bytes` : `${event.percent.toFixed(1)}%`;
      process.stderr.write(`\r正在下载 ${percent}`);
    }
  });
  if (!options.json && !options.progressJson) process.stderr.write('\n');
  await addTask({ type: 'download', status: 'success', title: `下载 ${detail.filename ?? fileId}`, data: result });
  printSuccess(result, options);
}

export async function createShare(
  fileIds: string[],
  options: GlobalOptions & { name?: string; expire?: string; pwd?: string }
): Promise<void> {
  const config = await readConfig(options);
  const client = createClient(config);
  const data = await client.share.create({
    shareName: options.name ?? `pan123-${new Date().toISOString().slice(0, 10)}`,
    shareExpire: Number(options.expire ?? 7),
    fileIDList: fileIds.join(','),
    sharePwd: options.pwd
  });
  await addTask({ type: 'share', status: 'success', title: `创建分享 ${fileIds.join(',')}`, data });
  printSuccess(data, options);
}

export async function enableDirectLink(folderId: number, options: GlobalOptions): Promise<void> {
  const config = await readConfig(options);
  const client = createClient(config);
  const data = await client.directLink.enable({ fileID: folderId });
  await addTask({ type: 'direct-link', status: 'success', title: `启用直链 ${folderId}`, data });
  printSuccess(data, options);
}

export async function disableDirectLink(folderId: number, options: GlobalOptions): Promise<void> {
  const config = await readConfig(options);
  const client = createClient(config);
  const data = await client.directLink.disable({ fileID: folderId });
  await addTask({ type: 'direct-link', status: 'success', title: `禁用直链 ${folderId}`, data });
  printSuccess(data, options);
}

export async function directLinkUrl(fileId: number, options: GlobalOptions): Promise<void> {
  const config = await readConfig(options);
  const client = createClient(config);
  const data = await client.directLink.url({ fileID: fileId });
  await addTask({ type: 'direct-link', status: 'success', title: `获取直链 ${fileId}`, data });
  printSuccess(data, options);
}
