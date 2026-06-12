import { createReadStream } from 'node:fs';
import { open, stat } from 'node:fs/promises';
import path from 'node:path';
import { Pan123ApiError } from './errors.js';
import { md5Buffer, md5File } from '../utils/hash.js';
import { retryTransientError, retryWhileFileChecking } from '../utils/retry.js';
import type { Pan123HttpClient } from './http-client.js';
import type {
  UploadCreateParams,
  UploadCreateData,
  UploadCompleteData,
  UploadFileOptions,
  UploadFileResult,
  UploadProgressEvent
} from './types.js';

const SINGLE_UPLOAD_MAX_BYTES = 1024 * 1024 * 1024; // 1GB
const DEFAULT_COMPLETE_POLLING_ATTEMPTS = 60;
const DEFAULT_COMPLETE_POLLING_DELAY_MS = 1000;

async function readFileRange(filePath: string, start: number, length: number): Promise<Buffer> {
  const handle = await open(filePath, 'r');
  try {
    const buffer = Buffer.allocUnsafe(length);
    const result = await handle.read(buffer, 0, length, start);
    return result.bytesRead === length ? buffer : buffer.subarray(0, result.bytesRead);
  } finally {
    await handle.close();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isCompletedUpload(data: UploadCompleteData | undefined): data is UploadCompleteData {
  return Boolean(data?.completed && data.fileID > 0);
}

async function emitProgress(
  callback: ((event: UploadProgressEvent) => void | Promise<void>) | undefined,
  event: UploadProgressEvent
): Promise<void> {
  await callback?.(event);
}

export class UploadApi {
  constructor(private http: Pan123HttpClient) {}

  async getDomains(): Promise<string[]> {
    return this.http.request<string[]>('GET', '/upload/v2/file/domain');
  }

  async create(params: UploadCreateParams): Promise<UploadCreateData> {
    return this.http.request<UploadCreateData>('POST', '/upload/v2/file/create', { body: params });
  }

  async uploadSlice(params: {
    uploadURL: string;
    preuploadID: string;
    sliceNo: number;
    sliceMD5: string;
    slice: Buffer;
    filename?: string;
  }): Promise<void> {
    const formData = new FormData();
    formData.append('preuploadID', params.preuploadID);
    formData.append('sliceNo', String(params.sliceNo));
    formData.append('sliceMD5', params.sliceMD5);
    
    const arrayBuffer = params.slice.buffer.slice(params.slice.byteOffset, params.slice.byteOffset + params.slice.byteLength) as ArrayBuffer;
    const blob = new Blob([arrayBuffer]);
    const fileName = params.filename || `file.part${params.sliceNo}`;
    formData.append('slice', blob, fileName);

    await this.http.request<void>('POST', '/upload/v2/file/slice', {
      baseURL: params.uploadURL,
      formData,
      timeout: this.http.uploadTimeout
    });
  }

  async complete(preuploadID: string): Promise<UploadCompleteData> {
    return retryWhileFileChecking(
      () =>
        this.http.request<UploadCompleteData>('POST', '/upload/v2/file/upload_complete', {
          body: { preuploadID }
        })
    );
  }

  private async singleUpload(params: {
    uploadURL: string;
    filePath: string;
    parentFileID: number;
    filename: string;
    etag: string;
    size: number;
    duplicate?: number;
    containDir?: boolean;
  }): Promise<UploadCompleteData> {
    const formData = new FormData();
    
    const { readFile } = await import('node:fs/promises');
    const fileBuffer = await readFile(params.filePath);
    const arrayBuffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength) as ArrayBuffer;
    const blob = new Blob([arrayBuffer]);
    formData.append('file', blob, params.filename);
    formData.append('parentFileID', String(params.parentFileID));
    formData.append('filename', params.filename);
    formData.append('etag', params.etag);
    formData.append('size', String(params.size));
    if (params.duplicate !== undefined) {
      formData.append('duplicate', String(params.duplicate));
    }
    if (params.containDir !== undefined) {
      formData.append('containDir', String(params.containDir));
    }

    return this.http.request<UploadCompleteData>('POST', '/upload/v2/file/single/create', {
      baseURL: params.uploadURL,
      formData,
      timeout: this.http.uploadTimeout
    });
  }

  private async waitForUploadComplete(
    preuploadID: string,
    options: {
      completePollingAttempts?: number;
      completePollingDelayMs?: number;
      transientRetryAttempts?: number;
      transientRetryDelayMs?: number;
    },
    onProgress: ((event: UploadProgressEvent) => void | Promise<void>) | undefined,
    totalBytes: number
  ): Promise<UploadCompleteData> {
    const attempts = Math.max(1, Math.floor(options.completePollingAttempts ?? DEFAULT_COMPLETE_POLLING_ATTEMPTS));
    const delayMs = Math.max(0, Math.floor(options.completePollingDelayMs ?? DEFAULT_COMPLETE_POLLING_DELAY_MS));
    let lastResponse: UploadCompleteData | undefined;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const completed = await retryTransientError(
          () => this.complete(preuploadID),
          {
            attempts: options.transientRetryAttempts,
            delayMs: options.transientRetryDelayMs
          }
        );
        lastResponse = completed;
        if (isCompletedUpload(completed)) {
          await emitProgress(onProgress, {
            stage: 'complete',
            loadedBytes: totalBytes,
            totalBytes,
            percent: 100,
            attempt
          });
          return completed;
        }
      } catch (error) {
        if (!(error instanceof Pan123ApiError && error.code === 20103) || attempt === attempts) {
          throw error;
        }
      }

      await emitProgress(onProgress, {
        stage: 'complete',
        loadedBytes: totalBytes,
        totalBytes,
        percent: 100,
        attempt
      });

      if (attempt < attempts) {
        await delay(delayMs);
      }
    }

    throw new Pan123ApiError({
      message: `Upload completion did not return completed=true with a valid fileID after ${attempts} polling attempts.`,
      response: lastResponse
    });
  }

  async uploadFile(options: UploadFileOptions): Promise<UploadFileResult> {
    const fileStat = await stat(options.filePath);
    const filename = options.filename ?? path.basename(options.filePath);
    const size = fileStat.size;

    await emitProgress(options.onProgress, {
      stage: 'hashing',
      loadedBytes: 0,
      totalBytes: size,
      percent: 0
    });

    const etag = await md5File(options.filePath);

    await emitProgress(options.onProgress, {
      stage: 'hashing',
      loadedBytes: size,
      totalBytes: size,
      percent: 100
    });

    const baseParams: UploadCreateParams = {
      parentFileID: options.parentFileID,
      filename,
      etag,
      size,
      duplicate: options.duplicate,
      containDir: options.containDir
    };

    const maxSingleBytes = options.singleUploadMaxBytes ?? SINGLE_UPLOAD_MAX_BYTES;

    if (size <= maxSingleBytes) {
      const uploadURL = (await this.getDomains())[0];
      if (!uploadURL) {
        throw new Pan123ApiError({ message: 'No upload domain returned by /upload/v2/file/domain' });
      }

      const data = await retryTransientError(
        () => this.singleUpload({ ...baseParams, uploadURL, filePath: options.filePath }),
        {
          attempts: options.transientRetryAttempts,
          delayMs: options.transientRetryDelayMs
        }
      );

      if (!isCompletedUpload(data)) {
        throw new Pan123ApiError({
          message: 'Single upload did not return a completed upload with a valid fileID.',
          response: data
        });
      }

      await emitProgress(options.onProgress, {
        stage: 'single',
        loadedBytes: size,
        totalBytes: size,
        percent: 100
      });

      return {
        fileID: data.fileID,
        completed: true
      };
    }

    await emitProgress(options.onProgress, {
      stage: 'create',
      loadedBytes: 0,
      totalBytes: size,
      percent: 0
    });

    const created = await retryTransientError(
      () => this.create(baseParams),
      {
        attempts: options.transientRetryAttempts,
        delayMs: options.transientRetryDelayMs
      }
    );

    if (created.reuse) {
      if (!created.fileID || created.fileID <= 0) {
        throw new Pan123ApiError({
          message: 'Upload create reported reuse but did not return a valid fileID.',
          response: created
        });
      }
      await emitProgress(options.onProgress, {
        stage: 'reuse',
        loadedBytes: size,
        totalBytes: size,
        percent: 100
      });
      return {
        fileID: created.fileID,
        completed: true,
        reuse: true
      };
    }

    if (!created.preuploadID || !created.sliceSize || !created.servers?.length) {
      throw new Pan123ApiError({
        message: 'Upload create did not return preuploadID, sliceSize, or servers'
      });
    }

    const uploadURL = created.servers[0];
    const sliceSize = created.sliceSize;
    const totalSlices = Math.ceil(size / sliceSize);

    for (let index = 0; index < totalSlices; index++) {
      const start = index * sliceSize;
      const length = Math.min(sliceSize, size - start);
      const buffer = await readFileRange(options.filePath, start, length);
      const sliceNo = index + 1;

      await retryTransientError(
        () =>
          this.uploadSlice({
            uploadURL,
            preuploadID: created.preuploadID!,
            sliceNo,
            sliceMD5: md5Buffer(buffer),
            slice: buffer,
            filename: `${filename}.part${sliceNo}`
          }),
        {
          attempts: options.transientRetryAttempts,
          delayMs: options.transientRetryDelayMs
        }
      );

      const loadedBytes = Math.min(size, start + length);
      await emitProgress(options.onProgress, {
        stage: 'slice',
        loadedBytes,
        totalBytes: size,
        percent: size === 0 ? 100 : (loadedBytes / size) * 100,
        sliceNo,
        totalSlices,
        completedSlices: sliceNo
      });
    }

    const completed = await this.waitForUploadComplete(created.preuploadID, options, options.onProgress, size);
    return {
      fileID: completed.fileID,
      completed: true
    };
  }
}
