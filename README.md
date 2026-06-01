# 123PanCLi

`123PanCLi` 是一个 123 云盘终端工具，提供 `pan123` 命令和 Ink TUI。它适合两类场景：

- 人在终端里打开 TUI 浏览、上传、下载、分享文件。
- 其他项目通过命令行调用 123 云盘上传/下载能力，避免每个项目重复写 123 云盘接口。

要求 Node.js `>= 18`。

## 安装

全局安装：

```bash
npm i -g 123pancli
```

安装后主命令：

```bash
pan123
```

本地开发：

```bash
pnpm install
pnpm run build
node dist/cli.js
```

## 配置

主配置文件：

```txt
~/.123pancli/config.json
```

首次运行 `pan123` 会进入 TUI 配置向导。也可以用命令写入配置：

```bash
pan123 config set --client-id <PAN123_CLIENT_ID> --client-secret <PAN123_CLIENT_SECRET>
```

配置文件结构：

```json
{
  "version": 1,
  "clientId": "",
  "clientSecret": "",
  "baseURL": "https://open-api.123pan.com",
  "defaultParentFileId": 0,
  "downloadDir": "~/Downloads/123pan"
}
```

`clientSecret` 会明文存储在 `config.json` 中，请保护好 `~/.123pancli` 目录。

临时覆盖配置，不会写回 `config.json`：

```bash
PAN123_CLIENT_ID=xxx PAN123_CLIENT_SECRET=yyy pan123 ls
pan123 --auth-client-id xxx --auth-client-secret yyy ls
```

## 输出协议

默认输出给人看。加 `--json` 后，最终结果输出到 `stdout`，结构稳定，适合程序解析。

成功：

```json
{
  "ok": true,
  "data": {}
}
```

失败：

```json
{
  "ok": false,
  "error": {
    "message": "错误信息",
    "code": 401,
    "traceId": "trace-id",
    "status": 401
  }
}
```

需要进度时，加 `--progress-json`。进度会输出到 `stderr`，一行一个 JSON，最终结果仍然输出到 `stdout`。

```bash
pan123 --json --progress-json upload ./app.zip --parent 0
pan123 --json --progress-json download 123456 --out ./downloads
```

进度事件示例：

```json
{"ok":true,"type":"progress","command":"download","loadedBytes":1048576,"totalBytes":10485760,"percent":10}
```

注意：

- 下载进度是字节级进度。服务端返回 `content-length` 时有 `percent`，否则只有 `loadedBytes`。
- 上传进度来自 `chest123-pan-sdk`。小文件单步上传目前只暴露阶段进度，例如 `hashing 100%`、`single 100%`；大文件分片上传会有分片进度，但不是完整网络字节级进度。

## 全局参数

这些参数放在子命令前面：

```bash
pan123 [全局参数] <command>
```

| 参数 | 说明 |
| --- | --- |
| `--json` | 最终结果以 JSON 输出到 `stdout` |
| `--progress-json` | 进度事件以 JSON Lines 输出到 `stderr` |
| `--auth-client-id <id>` | 临时覆盖 `clientId` |
| `--auth-client-secret <secret>` | 临时覆盖 `clientSecret` |
| `--base-url <url>` | 临时覆盖 API 基础地址 |
| `-V, --version` | 显示版本 |
| `-h, --help` | 显示帮助 |

示例：

```bash
pan123 --json ls 0
pan123 --json --progress-json upload ./app.zip --parent 0
```

## TUI

启动 TUI：

```bash
pan123
```

强制进入配置向导：

```bash
pan123 init
```

TUI 快捷键：

| 快捷键 | 说明 |
| --- | --- |
| `↑` / `↓` / `j` / `k` | 移动选择 |
| `enter` | 打开选中文件夹 |
| `h` / `backspace` | 返回上级 |
| `r` | 刷新 |
| `u` | 上传文件 |
| `m` | 新建目录 |
| `d` | 下载选中文件 |
| `s` | 分享选中文件 |
| `l` | 获取选中文件直链 |
| `q` | 退出 |

## 配置命令

### `pan123 config path`

输出配置文件路径。

```bash
pan123 config path
pan123 --json config path
```

JSON 返回：

```json
{
  "ok": true,
  "data": "C:\\Users\\LK130\\.123pancli\\config.json"
}
```

### `pan123 config show`

显示当前配置，`clientSecret` 会被遮罩。

```bash
pan123 config show
pan123 --json config show
```

JSON 返回：

```json
{
  "ok": true,
  "data": {
    "version": 1,
    "clientId": "your-client-id",
    "clientSecret": "abcd****wxyz",
    "baseURL": "https://open-api.123pan.com",
    "defaultParentFileId": 0,
    "downloadDir": "~/Downloads/123pan"
  }
}
```

### `pan123 config set`

写入配置。

```bash
pan123 config set --client-id <id> --client-secret <secret>
```

参数：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `--client-id <id>` | 是 | 123 云盘开放平台 clientId |
| `--client-secret <secret>` | 是 | 123 云盘开放平台 clientSecret |
| `--base-url <url>` | 否 | API 基础地址，默认 `https://open-api.123pan.com` |
| `--download-dir <path>` | 否 | 默认下载目录，默认 `~/Downloads/123pan` |
| `--default-parent-file-id <id>` | 否 | 默认上传目录，默认 `0` |

JSON 返回：

```json
{
  "ok": true,
  "data": {
    "path": "C:\\Users\\LK130\\.123pancli\\config.json",
    "config": {
      "version": 1,
      "clientId": "your-client-id",
      "clientSecret": "abcd****wxyz",
      "baseURL": "https://open-api.123pan.com",
      "defaultParentFileId": 0,
      "downloadDir": "~/Downloads/123pan"
    }
  }
}
```

### `pan123 config test`

测试配置是否可用，会调用 `client.user.info()`。

```bash
pan123 config test
pan123 --json config test
```

JSON 返回：123 云盘用户信息，字段由官方接口返回。

## 文件列表

### `pan123 ls [parentFileId]`

列出文件夹内容。`parentFileId` 不传时默认 `0`。

```bash
pan123 ls
pan123 ls 0
pan123 ls 38421550 --limit 100
pan123 ls 0 --search "setup"
pan123 --json ls 0
```

参数：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `[parentFileId]` | 否 | 父目录 ID，根目录为 `0` |
| `--limit <n>` | 否 | 每页数量，默认 `100` |
| `--search <text>` | 否 | 搜索关键字 |

JSON 返回：

```json
{
  "ok": true,
  "data": {
    "lastFileId": -1,
    "fileList": [
      {
        "fileID": 38421689,
        "filename": "app.exe",
        "type": 0,
        "size": 123456,
        "etag": "md5",
        "parentFileID": 38421550,
        "trashed": 0
      }
    ]
  }
}
```

说明：

- `type: 0` 表示文件。
- `type: 1` 表示文件夹。
- CLI 会过滤掉 `trashed === 1` 的文件。

## 创建目录

### `pan123 mkdir <name> --parent <fileId>`

创建云盘目录。

```bash
pan123 mkdir "assets" --parent 0
pan123 --json mkdir "assets" --parent 38421550
```

参数：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `<name>` | 是 | 目录名 |
| `--parent <fileId>` | 是 | 父目录 ID |

JSON 返回：

```json
{
  "ok": true,
  "data": {
    "dirID": 38421550
  }
}
```

## 上传文件

### `pan123 upload <path>`

上传本地文件到 123 云盘。

```bash
pan123 upload "C:\Users\LK130\Desktop\app.exe" --parent 38421550
pan123 upload "./app.zip" --parent 0 --name "release.zip"
pan123 upload "./app.zip" --parent 0 --overwrite
```

参数：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `<path>` | 是 | 本地文件路径 |
| `--parent <fileId>` | 否 | 上传到哪个目录。不传时使用 `config.json` 的 `defaultParentFileId` |
| `--name <name>` | 否 | 上传后的云盘文件名。不传时使用本地文件名 |
| `--overwrite` | 否 | 同名文件覆盖。默认保留两者 |

普通模式会在 `stderr` 显示阶段进度：

```txt
上传阶段 hashing 100.0%
上传阶段 single 100.0%
```

JSON 调用：

```bash
pan123 --json upload "C:\Users\LK130\Desktop\app.exe" --parent 38421550
```

JSON 返回：

```json
{
  "ok": true,
  "data": {
    "fileID": 38421689,
    "completed": true,
    "reuse": false
  }
}
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `fileID` | 上传成功后的云盘文件 ID |
| `completed` | 是否上传完成 |
| `reuse` | 是否秒传。不是每次都有 |

带机器可读进度：

```bash
pan123 --json --progress-json upload "C:\Users\LK130\Desktop\app.exe" --parent 38421550
```

`stderr` 进度事件示例：

```json
{"ok":true,"type":"progress","command":"upload","stage":"hashing","loadedBytes":0,"totalBytes":10485760,"percent":0}
{"ok":true,"type":"progress","command":"upload","stage":"hashing","loadedBytes":10485760,"totalBytes":10485760,"percent":100}
{"ok":true,"type":"progress","command":"upload","stage":"single","loadedBytes":10485760,"totalBytes":10485760,"percent":100}
```

分片上传时可能包含：

```json
{"ok":true,"type":"progress","command":"upload","stage":"slice","loadedBytes":5242880,"totalBytes":10485760,"percent":50,"sliceNo":1,"totalSlices":2,"completedSlices":1}
```

重要说明：

- 当前上传进度由 `chest123-pan-sdk` 提供。
- 小文件单步上传没有真实网络字节级进度，只能看到阶段变化。
- 大文件分片上传会按分片完成推进。
- 最终结果在 `stdout`，进度事件在 `stderr`。

Node.js 调用示例：

```js
import { spawn } from 'node:child_process';

const child = spawn('pan123', [
  '--json',
  '--progress-json',
  'upload',
  'C:\\Users\\LK130\\Desktop\\app.exe',
  '--parent',
  '38421550'
]);

let result = '';

child.stdout.on('data', chunk => {
  result += chunk.toString();
});

child.stderr.on('data', chunk => {
  for (const line of chunk.toString().trim().split(/\r?\n/)) {
    if (!line) continue;
    const event = JSON.parse(line);
    if (event.type === 'progress') {
      console.log('上传进度:', event);
    }
  }
});

child.on('close', code => {
  const finalResult = JSON.parse(result);
  console.log(code, finalResult);
});
```

## 下载文件

### `pan123 download <fileId>`

下载云盘文件到本地。

```bash
pan123 download 38421689 --out "C:\Users\LK130\Downloads"
pan123 download 38421689 --out "C:\Users\LK130\Downloads\app.exe"
```

参数：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `<fileId>` | 是 | 要下载的文件 ID |
| `--out <path>` | 否 | 输出目录或完整文件路径。不传时使用 `config.json` 的 `downloadDir` |

普通模式会在 `stderr` 显示下载进度：

```txt
正在下载 37.2%
```

JSON 调用：

```bash
pan123 --json download 38421689 --out "C:\Users\LK130\Downloads"
```

JSON 返回：

```json
{
  "ok": true,
  "data": {
    "path": "C:\\Users\\LK130\\Downloads\\app.exe",
    "bytes": 10485760
  }
}
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `path` | 本地保存路径 |
| `bytes` | 实际写入的字节数 |

带机器可读进度：

```bash
pan123 --json --progress-json download 38421689 --out "C:\Users\LK130\Downloads"
```

`stderr` 进度事件示例：

```json
{"ok":true,"type":"progress","command":"download","loadedBytes":1048576,"totalBytes":10485760,"percent":10}
{"ok":true,"type":"progress","command":"download","loadedBytes":5242880,"totalBytes":10485760,"percent":50}
{"ok":true,"type":"progress","command":"download","loadedBytes":10485760,"totalBytes":10485760,"percent":100}
```

如果服务端没有返回文件总大小，事件可能没有 `totalBytes` 和 `percent`：

```json
{"ok":true,"type":"progress","command":"download","loadedBytes":1048576}
```

Node.js 调用示例：

```js
import { spawn } from 'node:child_process';

const child = spawn('pan123', [
  '--json',
  '--progress-json',
  'download',
  '38421689',
  '--out',
  'C:\\Users\\LK130\\Downloads'
]);

let result = '';

child.stdout.on('data', chunk => {
  result += chunk.toString();
});

child.stderr.on('data', chunk => {
  for (const line of chunk.toString().trim().split(/\r?\n/)) {
    if (!line) continue;
    const event = JSON.parse(line);
    if (event.type === 'progress') {
      console.log('下载进度:', event);
    }
  }
});

child.on('close', code => {
  const finalResult = JSON.parse(result);
  console.log(code, finalResult);
});
```

## 分享

### `pan123 share create <fileIds...>`

创建普通分享链接。

```bash
pan123 share create 38421689 --name "测试分享" --expire 7
pan123 share create 38421689 38421690 --name "批量分享" --expire 0 --pwd 1234
pan123 --json share create 38421689 --name "测试分享" --expire 7
```

参数：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `<fileIds...>` | 是 | 一个或多个文件 ID |
| `--name <name>` | 否 | 分享名称。默认 `pan123-YYYY-MM-DD` |
| `--expire <days>` | 否 | 有效期，可选 `1`、`7`、`30`、`0`，默认 `7`，`0` 表示永久 |
| `--pwd <code>` | 否 | 提取码 |

JSON 返回：

```json
{
  "ok": true,
  "data": {
    "shareID": 123456,
    "shareKey": "abcdef"
  }
}
```

返回字段由 123 云盘官方接口决定，通常包含 `shareID` 和 `shareKey`。

## 直链

### `pan123 direct-link enable <folderId>`

启用某个文件夹的直链空间。

```bash
pan123 direct-link enable 38421550
pan123 --json direct-link enable 38421550
```

JSON 返回：官方接口返回的数据，通常包含启用成功的文件夹信息。

### `pan123 direct-link disable <folderId>`

禁用某个文件夹的直链空间。

```bash
pan123 direct-link disable 38421550
pan123 --json direct-link disable 38421550
```

JSON 返回：官方接口返回的数据。

### `pan123 direct-link url <fileId>`

获取文件直链。

```bash
pan123 direct-link url 38421689
pan123 --json direct-link url 38421689
```

如果提示未启用直链空间，先启用文件所在目录：

```bash
pan123 direct-link enable 38421550
pan123 direct-link url 38421689
```

JSON 返回：

```json
{
  "ok": true,
  "data": {
    "url": "https://..."
  }
}
```

## 常见组合命令

上传到指定目录：

```bash
pan123 upload "C:\Users\LK130\Desktop\adofaimusicbox_1.0.0_x64-setup.exe" --parent 38421550
```

下载指定文件：

```bash
pan123 download 38421689 --out "C:\Users\LK130\Downloads"
```

获取直链：

```bash
pan123 direct-link url 38421689
```

给程序调用并监听进度：

```bash
pan123 --json --progress-json upload "C:\Users\LK130\Desktop\app.exe" --parent 38421550
pan123 --json --progress-json download 38421689 --out "C:\Users\LK130\Downloads"
```

## 开发

```bash
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
```
