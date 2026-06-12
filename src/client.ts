import { createPan123Client, Pan123ApiError } from './api/index.js';
import type { Pan123CliConfig } from './config.js';

export function createClient(config: Pan123CliConfig) {
  return createPan123Client({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    baseURL: config.baseURL,
    requestTimeout: config.requestTimeout,
    uploadTimeout: config.uploadTimeout,
    downloadTimeout: config.downloadTimeout
  });
}

export function normalizeError(error: unknown): { message: string; code?: number; traceId?: string; status?: number } {
  if (error instanceof Pan123ApiError) {
    return {
      message: error.message,
      code: error.code,
      traceId: error.traceId,
      status: error.status
    };
  }
  if (error instanceof Error) return { message: error.message };
  return { message: String(error) };
}
