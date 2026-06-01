import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export async function downloadToFile(url: string, outputPath: string): Promise<{ path: string; bytes?: number }> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Download failed with HTTP ${response.status}`);
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  const stream = Readable.fromWeb(response.body as unknown as import('node:stream/web').ReadableStream);
  await pipeline(stream, createWriteStream(outputPath));
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
