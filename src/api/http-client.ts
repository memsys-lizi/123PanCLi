import { Pan123ApiError } from './errors.js';
import type {
  HttpMethod,
  Pan123ClientOptions,
  Pan123RequestOptions,
  Pan123Response,
  AccessTokenData
} from './types.js';

const DEFAULT_BASE_URL = 'https://open-api.123pan.com';
const DEFAULT_PLATFORM = 'open_platform';
const DEFAULT_REQUEST_TIMEOUT = 300000; // 5 minutes
const DEFAULT_UPLOAD_TIMEOUT = 1200000; // 20 minutes

function toDateMs(value?: string | Date | number): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return value;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : undefined;
}

function isPan123Response(value: unknown): value is Pan123Response {
  return Boolean(value && typeof value === 'object' && 'code' in value && 'message' in value);
}

function isTokenExpiredError(error: Pan123ApiError): boolean {
  const message = error.message.toLowerCase();
  return (
    error.code === 401 ||
    error.status === 401 ||
    message.includes('token is expired') ||
    message.includes('access_token') ||
    message.includes('access token') ||
    message.includes('token expired')
  );
}

export class Pan123HttpClient {
  readonly baseURL: string;
  readonly platform: string;
  readonly requestTimeout: number;
  readonly uploadTimeout: number;
  readonly clientId: string;
  readonly clientSecret: string;

  private accessToken?: string;
  private tokenExpiresAtMs?: number;

  constructor(options: Pan123ClientOptions) {
    this.baseURL = options.baseURL ?? DEFAULT_BASE_URL;
    this.platform = DEFAULT_PLATFORM;
    this.requestTimeout = options.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT;
    this.uploadTimeout = options.uploadTimeout ?? DEFAULT_UPLOAD_TIMEOUT;
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
  }

  setAccessToken(token: string, expiresAt?: string | Date | number): void {
    this.accessToken = token;
    this.tokenExpiresAtMs = toDateMs(expiresAt);
  }

  async ensureAccessToken(): Promise<string> {
    const refreshAt = (this.tokenExpiresAtMs ?? 0) - 60_000;
    if (this.accessToken && (!this.tokenExpiresAtMs || Date.now() < refreshAt)) {
      return this.accessToken;
    }
    const data = await this.getAccessToken();
    return data.accessToken;
  }

  async getAccessToken(): Promise<AccessTokenData> {
    const data = await this.request<AccessTokenData>('POST', '/api/v1/access_token', {
      auth: false,
      body: {
        clientID: this.clientId,
        clientSecret: this.clientSecret
      }
    });
    this.accessToken = data.accessToken;
    this.tokenExpiresAtMs = toDateMs(data.expiredAt);
    return data;
  }

  async request<T = unknown>(
    method: HttpMethod,
    requestPath: string,
    options: Pan123RequestOptions = {}
  ): Promise<T> {
    return this.requestOnce<T>(method, requestPath, options, true);
  }

  private clearAccessToken(): void {
    this.accessToken = undefined;
    this.tokenExpiresAtMs = undefined;
  }

  private async requestOnce<T = unknown>(
    method: HttpMethod,
    requestPath: string,
    options: Pan123RequestOptions,
    allowTokenRefreshRetry: boolean
  ): Promise<T> {
    const headers: Record<string, string> = {
      Platform: this.platform,
      ...options.headers
    };

    if (options.auth !== false) {
      headers.Authorization = `Bearer ${await this.ensureAccessToken()}`;
    }

    let body: BodyInit | undefined;
    const baseURL = options.baseURL ?? this.baseURL;
    const url = new URL(requestPath, baseURL);

    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      }
    }

    if (options.formData) {
      body = options.formData;
    } else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }

    const timeout = options.timeout ?? this.requestTimeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseBody = await response.json();

      if (isPan123Response(responseBody)) {
        if (responseBody.code !== 0) {
          throw new Pan123ApiError({
            code: responseBody.code,
            message: responseBody.message,
            traceId: responseBody['x-traceID'],
            status: response.status,
            response: responseBody
          });
        }
        return responseBody.data as T;
      }

      return responseBody as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Pan123ApiError) {
        if (
          allowTokenRefreshRetry &&
          options.auth !== false &&
          isTokenExpiredError(error)
        ) {
          this.clearAccessToken();
          return this.requestOnce<T>(method, requestPath, options, false);
        }
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Pan123ApiError({
          message: `Request timeout after ${timeout}ms`,
          code: -1
        });
      }

      if (error instanceof Error) {
        throw new Pan123ApiError({
          message: error.message
        });
      }

      throw error;
    }
  }
}
