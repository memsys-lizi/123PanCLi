import { retryWhileFileChecking } from '../utils/retry.js';
import type { Pan123HttpClient } from './http-client.js';
import type {
  FileListParams,
  FileListData,
  FileInfo,
  DownloadInfoData
} from './types.js';

export class FilesApi {
  constructor(private http: Pan123HttpClient) {}

  async list(params: FileListParams): Promise<FileListData> {
    return this.http.request<FileListData>('GET', '/api/v2/file/list', { 
      query: params as unknown as Record<string, unknown>
    });
  }

  async detail(params: { fileID: number }): Promise<FileInfo> {
    return this.http.request<FileInfo>('GET', '/api/v1/file/detail', { query: params });
  }

  async mkdir(params: { name: string; parentID: number }): Promise<{ dirID: number }> {
    return this.http.request<{ dirID: number }>('POST', '/upload/v1/file/mkdir', { body: params });
  }

  async downloadInfo(params: { fileId: number }): Promise<DownloadInfoData> {
    return retryWhileFileChecking(
      () =>
        this.http.request<DownloadInfoData>('GET', '/api/v1/file/download_info', {
          query: { fileId: params.fileId }
        })
    );
  }
}
