import { afterEach, describe, expect, it, vi } from 'vitest';
import { Pan123ApiError } from '../src/api/errors.js';
import { printError, printSuccess } from '../src/output.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('output', () => {
  it('prints stable success JSON', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    printSuccess({ fileID: 1 }, { json: true });
    expect(JSON.parse(log.mock.calls[0]?.[0] as string)).toEqual({
      ok: true,
      data: { fileID: 1 }
    });
  });

  it('prints stable error JSON', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    printError(new Pan123ApiError({ code: 401, message: 'token is expired', traceId: 'trace' }), { json: true });
    expect(JSON.parse(error.mock.calls[0]?.[0] as string)).toEqual({
      ok: false,
      error: {
        message: 'token is expired',
        code: 401,
        traceId: 'trace'
      }
    });
  });
});
