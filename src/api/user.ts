import type { Pan123HttpClient } from './http-client.js';
import type { UserInfo } from './types.js';

export class UserApi {
  constructor(private http: Pan123HttpClient) {}

  async info(): Promise<UserInfo> {
    return this.http.request<UserInfo>('GET', '/api/v1/user/info');
  }
}
