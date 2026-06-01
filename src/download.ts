import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';
import { Readable } from 'node:stream';

export interface DownloadProgressEvent {
  loadedBytes: number;
  totalBytes?: number;
  percent?: number;
}

export async function downloadToFile(
  url: string,
  outputPath: string,
  onProgress?: (event: DownloadProgressEvent) => void | Promise<void>
): Promise<{ path: string; bytes?: number }> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Download failed with HTTP ${response.status}`);
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  const totalBytesHeader = response.headers.get('content-length');
  const totalBytes = totalBytesHeader ? Number(totalBytesHeader) : undefined;
  let loadedBytes = 0;
  const stream = Readable.fromWeb(response.body as unknown as import('node:stream/web').ReadableStream);
  const output = createWriteStream(outputPath);
  try {
    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBuffer);
      loadedBytes += buffer.length;
      if (!output.write(buffer)) {
        await once(output, 'drain');
      }
      await onProgress?.({
        loadedBytes,
        totalBytes,
        percent: totalBytes && totalBytes > 0 ? (loadedBytes / totalBytes) * 100 : undefined
      });
    }
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => reject(error);
      output.once('error', onError);
      output.end(() => {
        output.off('error', onError);
        resolve();
      });
    });
  } finally {
    if (!output.closed) output.destroy();
  }
  const fileStat = await stat(outputPath);
  return { path: outputPath, bytes: fileStat.size };
}

export async function resolveDownloadOutput(options: {
  out?: string;
  downloadDir: string;
  filename?: string;
  fileId: number;
}): Promise<string> {
  const filename = options.filename || `${options.fileId}`;
  if (!options.out) return path.join(options.downloadDir, filename);
  try {
    const outputStat = await stat(options.out);
    if (outputStat.isDirectory()) return path.join(options.out, filename);
  } catch {
    // A missing path is treated as the desired file path.
  }
  return options.out;
}
