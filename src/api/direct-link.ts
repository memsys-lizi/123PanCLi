import { retryWhileFileChecking } from '../utils/retry.js';
import type { Pan123HttpClient } from './http-client.js';
import type { DirectLinkUrlData } from './types.js';

export class DirectLinkApi {
  constructor(private http: Pan123HttpClient) {}

  async enable(params: { fileID: number }): Promise<{ filename: string }> {
    return this.http.request<{ filename: string }>('POST', '/api/v1/direct-link/enable', { body: params });
  }

  async disable(params: { fileID: number }): Promise<{ filename: string }> {
    return this.http.request<{ filename: string }>('POST', '/api/v1/direct-link/disable', { body: params });
  }

  async url(params: { fileID: number }): Promise<DirectLinkUrlData> {
    return retryWhileFileChecking(
      () =>
        this.http.request<DirectLinkUrlData>('GET', '/api/v1/direct-link/url', {
          query: { fileID: params.fileID }
        })
    );
  }
}
