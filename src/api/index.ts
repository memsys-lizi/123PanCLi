export * from './errors.js';
export * from './types.js';
export * from './http-client.js';
export * from './user.js';
export * from './files.js';
export * from './share.js';
export * from './direct-link.js';
export * from './upload.js';

import { Pan123HttpClient } from './http-client.js';
import { UserApi } from './user.js';
import { FilesApi } from './files.js';
import { ShareApi } from './share.js';
import { DirectLinkApi } from './direct-link.js';
import { UploadApi } from './upload.js';
import type { Pan123ClientOptions } from './types.js';

export function createPan123Client(options: Pan123ClientOptions) {
  const http = new Pan123HttpClient(options);

  return {
    user: new UserApi(http),
    files: new FilesApi(http),
    share: new ShareApi(http),
    directLink: new DirectLinkApi(http),
    upload: new UploadApi(http)
  };
}
