import path from 'node:path';
import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { createClient, normalizeError } from '../client.js';
import { resolveDownloadDir, type Pan123CliConfig } from '../config.js';
import { downloadToFile, resolveDownloadOutput } from '../download.js';
import { addTask, readTasks, type TaskRecord } from '../tasks.js';
import { padDisplayEnd, padDisplayStart } from './text-width.js';
import { CommandBar, EmptyState, Panel, Shell, SpinnerText, StatusLine } from './ui.js';

interface FileBrowserProps {
  config: Pan123CliConfig;
}

interface FileItem {
  fileID?: number;
  fileId?: number;
  filename: string;
  type: number;
  size?: number;
  trashed?: number;
}

type PromptMode = 'upload' | 'mkdir' | undefined;

interface FolderCrumb {
  id: number;
  name: string;
}

function getFileId(file: FileItem | undefined): number | undefined {
  return file?.fileID ?? file?.fileId;
}

function formatSize(size?: number): string {
  if (!size) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function truncate(value: string, width: number): string {
  return padDisplayEnd(value, width);
}

function taskIcon(status: TaskRecord['status']): string {
  if (status === 'success') return '✓';
  if (status === 'failed') return '✕';
  return '●';
}

export function FileBrowser({ config }: FileBrowserProps) {
  const { exit } = useApp();
  const client = useMemo(() => createClient(config), [config]);
  const [parentId, setParentId] = useState(config.defaultParentFileId);
  const [history, setHistory] = useState<FolderCrumb[]>([]);
  const [currentName, setCurrentName] = useState(config.defaultParentFileId === 0 ? '根目录' : String(config.defaultParentFileId));
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState('正在加载文件...');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [promptMode, setPromptMode] = useState<PromptMode>();
  const [promptValue, setPromptValue] = useState('');
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [user, setUser] = useState<Record<string, unknown> | undefined>();

  async function loadFiles(nextParentId = parentId) {
    setError(undefined);
    setBusy(true);
    setStatus('正在加载文件...');
    try {
      if (!user) {
        createClient(config)
          .user.info()
          .then(info => setUser(info as Record<string, unknown>))
          .catch(() => undefined);
      }
      const data = await client.files.list({ parentFileId: nextParentId, limit: 100 });
      const nextFiles = data.fileList.filter(file => file.trashed !== 1) as FileItem[];
      setFiles(nextFiles);
      setSelected(0);
      setStatus(`共 ${nextFiles.length} 项`);
      setTasks((await readTasks()).slice(0, 5));
    } catch (caught) {
      const normalized = normalizeError(caught);
      setError(`${normalized.message}${normalized.traceId ? ` traceId=${normalized.traceId}` : ''}`);
      setStatus('加载失败');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadFiles(parentId);
  }, [parentId]);

  async function runAction(title: string, action: () => Promise<unknown>, type: TaskRecord['type']) {
    setError(undefined);
    setBusy(true);
    setStatus(title);
    try {
      const data = await action();
      await addTask({ type, status: 'success', title, data });
      setTasks((await readTasks()).slice(0, 5));
      setStatus('操作完成');
      await loadFiles(parentId);
    } catch (caught) {
      const normalized = normalizeError(caught);
      await addTask({ type, status: 'failed', title, error: normalized });
      setError(`${normalized.message}${normalized.traceId ? ` traceId=${normalized.traceId}` : ''}`);
      setStatus('操作失败');
    } finally {
      setBusy(false);
    }
  }

  async function submitPrompt(value: string) {
    const trimmed = value.trim();
    const mode = promptMode;
    setPromptMode(undefined);
    setPromptValue('');
    if (!trimmed || !mode) return;
    if (mode === 'mkdir') {
      await runAction(`创建目录 ${trimmed}`, () => client.files.mkdir({ name: trimmed, parentID: parentId }), 'mkdir');
      return;
    }
    await runAction(
      `上传 ${path.basename(trimmed)}`,
      () =>
        client.upload.uploadFile({
          filePath: trimmed,
          parentFileID: parentId,
          duplicate: 1,
          onProgress: event => setStatus(`正在上传 ${event.stage} ${event.percent.toFixed(1)}%`)
        }),
      'upload'
    );
  }

  useInput((input, key) => {
    if (promptMode) return;
    if (input === 'q') exit();
    if (key.upArrow || input === 'k') setSelected(value => Math.max(0, value - 1));
    if (key.downArrow || input === 'j') setSelected(value => Math.min(files.length - 1, value + 1));
    if (input === 'r') void loadFiles(parentId);
    if (input === 'u') setPromptMode('upload');
    if (input === 'm') setPromptMode('mkdir');
    if (key.backspace || input === 'h') {
      const previous = history.at(-1);
      if (previous !== undefined) {
        setHistory(items => items.slice(0, -1));
        setParentId(previous.id);
        setCurrentName(previous.name);
      }
    }
    if (key.return) {
      const current = files[selected];
      const fileId = getFileId(current);
      if (current?.type === 1 && fileId !== undefined) {
        setHistory(items => [...items, { id: parentId, name: currentName }]);
        setCurrentName(current.filename);
        setParentId(fileId);
      }
    }
    if (input === 'd') {
      const current = files[selected];
      const fileId = getFileId(current);
      if (!current || fileId === undefined || current.type === 1) return;
      void runAction(
        `下载 ${current.filename}`,
        async () => {
          const info = await client.files.downloadInfo({ fileId });
          const outputPath = await resolveDownloadOutput({
            downloadDir: resolveDownloadDir(config),
            filename: current.filename,
            fileId
          });
          return downloadToFile(info.downloadUrl, outputPath, event => {
            const progress = event.percent === undefined ? `${event.loadedBytes} bytes` : `${event.percent.toFixed(1)}%`;
            setStatus(`正在下载 ${progress}`);
          });
        },
        'download'
      );
    }
    if (input === 's') {
      const current = files[selected];
      const fileId = getFileId(current);
      if (!current || fileId === undefined) return;
      void runAction(
        `分享 ${current.filename}`,
        () =>
          client.share.create({
            shareName: current.filename,
            shareExpire: 7,
            fileIDList: String(fileId)
          }),
        'share'
      );
    }
    if (input === 'l') {
      const current = files[selected];
      const fileId = getFileId(current);
      if (!current || fileId === undefined || current.type === 1) return;
      void runAction(`获取直链 ${current.filename}`, () => client.directLink.url({ fileID: fileId }), 'direct-link');
    }
  });

  const visibleStart = Math.max(0, Math.min(selected - 7, Math.max(0, files.length - 15)));
  const visibleFiles = files.slice(visibleStart, visibleStart + 15);
  const selectedFile = files[selected];
  const pathLabel = [...history.map(item => item.name), currentName].join(' / ');
  const typeWidth = 4;
  const nameWidth = 34;
  const sizeWidth = 10;
  const idWidth = 10;

  return (
    <Shell subtitle="文件 · 上传 · 下载 · 分享 · 直链">
      <Box flexDirection="row">
        <Panel title="◆ 工作区" width={29} color="magenta">
          <Text color="gray">账号</Text>
          <Text>{String(user?.nickname ?? user?.uid ?? '未加载')}</Text>
          <Box marginTop={1} flexDirection="column">
            <Text color="gray">位置</Text>
            <Text>{truncate(pathLabel, 23)}</Text>
            <Text color="gray">目录 ID {parentId}</Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Text color="gray">选中</Text>
            <Text>{selectedFile ? truncate(selectedFile.filename, 23) : '无'}</Text>
            <Text color="gray">
              {selectedFile ? `${selectedFile.type === 1 ? '文件夹' : '文件'} · ID ${getFileId(selectedFile) ?? '-'}` : ''}
            </Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Text color="gray">最近任务</Text>
            {tasks.length ? (
              tasks.slice(0, 4).map(task => (
                <Text key={task.id} color={task.status === 'failed' ? 'red' : task.status === 'success' ? 'green' : 'yellow'}>
                  {taskIcon(task.status)} {truncate(task.title, 20)}
                </Text>
              ))
            ) : (
              <Text color="gray">暂无任务</Text>
            )}
          </Box>
        </Panel>
        <Box marginLeft={1} flexGrow={1}>
          <Panel title="文件列表" color="cyan">
            <Box>
            <Text color="gray">
              {'  '} {padDisplayEnd('类型', typeWidth)} {padDisplayEnd('名称', nameWidth)} {padDisplayStart('大小', sizeWidth)}{' '}
              {padDisplayStart('ID', idWidth)}
            </Text>
            </Box>
            {busy && files.length === 0 ? (
              <Box paddingY={1}>
                <SpinnerText label="正在加载目录" />
              </Box>
            ) : files.length === 0 ? (
              <EmptyState title="这个目录是空的" hint="按 u 上传文件，或按 m 创建目录。" />
            ) : (
              visibleFiles.map((file, offset) => {
                const index = visibleStart + offset;
                const isSelected = index === selected;
                const fileId = getFileId(file);
                const type = file.type === 1 ? '目录' : '文件';
                const name = padDisplayEnd(file.filename, nameWidth);
                const size = padDisplayStart(formatSize(file.size), sizeWidth);
                const id = padDisplayStart(String(fileId ?? '-'), idWidth);
                return (
                  <Text key={`${fileId ?? file.filename}-${index}`} color={isSelected ? 'cyan' : undefined} inverse={isSelected}>
                    {isSelected ? '›' : ' '} {padDisplayEnd(type, typeWidth)} {name} {size} <Text color={isSelected ? undefined : 'gray'}>{id}</Text>
                  </Text>
                );
              })
            )}
          </Panel>
        </Box>
      </Box>
      {promptMode ? (
        <Panel title={promptMode === 'upload' ? '上传文件' : '创建目录'} color="yellow">
          <Box>
            <Text color="yellow">{promptMode === 'upload' ? '本地路径 ' : '目录名称 '}</Text>
            <TextInput value={promptValue} onChange={setPromptValue} onSubmit={submitPrompt} />
          </Box>
        </Panel>
      ) : null}
      <StatusLine busy={busy} error={error} message={status} />
      <CommandBar
        items={[
          ['↑↓/jk', '移动'],
          ['enter', '打开'],
          ['h', '返回'],
          ['r', '刷新'],
          ['u', '上传'],
          ['m', '新建目录'],
          ['d', '下载'],
          ['s', '分享'],
          ['l', '直链'],
          ['q', '退出']
        ]}
      />
    </Shell>
  );
}
