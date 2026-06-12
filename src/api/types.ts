export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface Pan123Response<T = unknown> {
  code: number;
  message: string;
  data: T;
  'x-traceID'?: string;
}

export interface Pan123ClientOptions {
  clientId: string;
  clientSecret: string;
  baseURL: string;
  requestTimeout?: number;
  uploadTimeout?: number;
  downloadTimeout?: number;
}

export interface Pan123RequestOptions {
  query?: Record<string, unknown>;
  body?: unknown;
  formData?: FormData;
  headers?: Record<string, string>;
  baseURL?: string;
  auth?: boolean;
  timeout?: number;
}

export interface AccessTokenData {
  accessToken: string;
  expiredAt: string;
}

export interface FileInfo {
  fileID?: number;
  fileId?: number;
  filename: string;
  type: number;
  size: number;
  etag?: string;
  status?: number;
  parentFileID?: number;
  parentFileId?: number;
  createAt?: string;
  updateAt?: string;
  trashed?: number;
  category?: number;
  [key: string]: unknown;
}

export interface FileListParams {
  parentFileId: number;
  limit: number;
  searchData?: string;
  searchMode?: number;
  lastFileId?: number;
}

export interface FileListData {
  lastFileId: number;
  fileList: FileInfo[];
}

export interface UploadCreateParams {
  parentFileID: number;
  filename: string;
  etag: string;
  size: number;
  duplicate?: number;
  containDir?: boolean;
}

export interface UploadCreateData {
  fileID?: number;
  reuse: boolean;
  preuploadID?: string;
  sliceSize?: number;
  servers?: string[];
}

export interface UploadCompleteData {
  completed: boolean;
  fileID: number;
}

export type UploadProgressStage = 'hashing' | 'single' | 'create' | 'reuse' | 'slice' | 'complete';

export interface UploadProgressEvent {
  stage: UploadProgressStage;
  loadedBytes: number;
  totalBytes: number;
  percent: number;
  sliceNo?: number;
  totalSlices?: number;
  completedSlices?: number;
  attempt?: number;
}

export interface UploadFileOptions {
  filePath: string;
  parentFileID: number;
  filename?: string;
  duplicate?: number;
  containDir?: boolean;
  singleUploadMaxBytes?: number;
  completePollingAttempts?: number;
  completePollingDelayMs?: number;
  transientRetryAttempts?: number;
  transientRetryDelayMs?: number;
  onProgress?: (event: UploadProgressEvent) => void | Promise<void>;
}

export interface UploadFileResult {
  fileID: number;
  completed: boolean;
  reuse?: boolean;
}

export interface DownloadInfoData {
  downloadUrl: string;
}

export interface DirectLinkUrlData {
  url: string;
}

export interface ShareCreateParams {
  shareName: string;
  shareExpire: number;
  fileIDList: string;
  sharePwd?: string;
}

export interface ShareCreateData {
  shareID: number;
  shareKey: string;
}

export interface UserInfo {
  uid: number;
  nickname: string;
  headImage?: string;
  passport?: string;
  mail?: string;
  spaceUsed?: number;
  spacePermanent?: number;
  spaceTemp?: number;
  spaceTempExpr?: string | number;
  vip?: boolean;
  directTraffic?: number;
  isHideUID?: boolean;
  httpsCount?: number;
  vipInfo?: unknown;
  developerInfo?: unknown;
  [key: string]: unknown;
}
