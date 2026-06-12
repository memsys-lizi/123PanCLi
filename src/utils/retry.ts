import { Pan123ApiError } from '../api/errors.js';

const FILE_CHECKING_CODE = 20103;
const DEFAULT_RETRY_ATTEMPTS = 60;
const DEFAULT_RETRY_DELAY_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isFileCheckingError(error: unknown): boolean {
  return error instanceof Pan123ApiError && error.code === FILE_CHECKING_CODE;
}

function isTransientUploadError(error: unknown): boolean {
  if (!(error instanceof Pan123ApiError)) return false;
  if (error.status === 429 || error.code === 429) return true;
  const message = error.message;
  return error.code === 1 && (message.includes('秒传队列') || message.includes('削峰') || message.includes('请慢一点'));
}

export interface RetryOptions {
  attempts?: number;
  delayMs?: number;
}

export async function retryWhileFileChecking<T>(
  task: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const attempts = Math.max(1, Math.floor(options.attempts ?? DEFAULT_RETRY_ATTEMPTS));
  const delayMs = Math.max(0, Math.floor(options.delayMs ?? DEFAULT_RETRY_DELAY_MS));

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (!isFileCheckingError(error) || attempt === attempts) {
        throw error;
      }
      await delay(delayMs);
    }
  }

  throw new Pan123ApiError({
    code: FILE_CHECKING_CODE,
    message: 'File checking did not finish before retry attempts were exhausted.'
  });
}

export async function retryTransientError<T>(
  task: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const attempts = Math.max(1, Math.floor(options.attempts ?? 5));
  const delayMs = Math.max(0, Math.floor(options.delayMs ?? DEFAULT_RETRY_DELAY_MS));

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (!isTransientUploadError(error) || attempt === attempts) {
        throw error;
      }
      await delay(delayMs);
    }
  }

  throw new Pan123ApiError({
    message: 'Transient upload retry attempts were exhausted.'
  });
}
