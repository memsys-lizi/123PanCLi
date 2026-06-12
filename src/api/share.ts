import type { Pan123HttpClient } from './http-client.js';
import type { ShareCreateParams, ShareCreateData } from './types.js';

export class ShareApi {
  constructor(private http: Pan123HttpClient) {}

  async create(params: ShareCreateParams): Promise<ShareCreateData> {
    return this.http.request<ShareCreateData>('POST', '/api/v1/share/create', { body: params });
  }
}
