# 123PanCLi

`123PanCLi` is a Node.js CLI and Ink TUI for 123 云盘. It provides a reusable terminal workflow for file browsing, upload, download, sharing, and direct links.

## Install

```bash
pnpm install
pnpm run build
pnpm link --global
```

After linking or installing globally, use:

```bash
pan123
```

## Configuration

The main config file is:

```txt
~/.123pancli/config.json
```

First launch opens a TUI setup wizard. You can also write config from the CLI:

```bash
pan123 config set --client-id your-client-id --client-secret your-client-secret
pan123 config test
```

`clientSecret` is stored in plain text in `config.json`, so protect the `~/.123pancli` directory. Environment variables and CLI flags can temporarily override credentials without writing them back:

```bash
PAN123_CLIENT_ID=xxx PAN123_CLIENT_SECRET=yyy pan123 ls
pan123 --auth-client-id xxx --auth-client-secret yyy ls
```

## Commands

```bash
pan123
pan123 init
pan123 config path
pan123 config show
pan123 config test
pan123 ls 0
pan123 mkdir "assets" --parent 0
pan123 upload ./dist/app.zip --parent 0
pan123 download 123456 --out ./downloads
pan123 share create 123456 --name "release" --expire 7
pan123 direct-link enable 123456
pan123 direct-link url 123457
```

Most commands support `--json` for project integration:

```bash
pan123 upload ./dist/app.zip --parent 0 --json
```

Success output:

```json
{
  "ok": true,
  "data": {}
}
```

Failure output:

```json
{
  "ok": false,
  "error": {
    "message": "error message",
    "code": 401,
    "traceId": "trace-id"
  }
}
```

## TUI

Run `pan123` to open the TUI. Keyboard shortcuts:

- `enter`: open selected directory
- `h` or backspace: go back
- `r`: refresh
- `u`: upload a local file
- `m`: create directory
- `d`: download selected file
- `s`: create share for selected item
- `l`: get direct-link URL for selected file
- `q`: quit

## Development

```bash
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
```
