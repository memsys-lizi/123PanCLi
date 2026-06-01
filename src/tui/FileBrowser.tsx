import path from 'node:path';
import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { createClient, normalizeError } from '../client.js';
import { resolveDownloadDir, type Pan123CliConfig } from '../config.js';
import { downloadToFile, resolveDownloadOutput } from '../download.js';
import { addTask, readTasks, type TaskRecord } from '../tasks.js';

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

export function FileBrowser({ config }: FileBrowserProps) {
  const { exit } = useApp();
  const client = useMemo(() => createClient(config), [config]);
  const [parentId, setParentId] = useState(config.defaultParentFileId);
  const [history, setHistory] = useState<number[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState('Loading files...');
  const [error, setError] = useState<string | undefined>();
  const [promptMode, setPromptMode] = useState<PromptMode>();
  const [promptValue, setPromptValue] = useState('');
  const [tasks, setTasks] = useState<TaskRecord[]>([]);

  async function loadFiles(nextParentId = parentId) {
    setError(undefined);
    setStatus('Loading files...');
    try {
      const data = await client.files.list({ parentFileId: nextParentId, limit: 100 });
      const nextFiles = data.fileList.filter(file => file.trashed !== 1) as FileItem[];
      setFiles(nextFiles);
      setSelected(0);
      setStatus(`${nextFiles.length} item(s)`);
      setTasks((await readTasks()).slice(0, 5));
    } catch (caught) {
      const normalized = normalizeError(caught);
      setError(`${normalized.message}${normalized.traceId ? ` traceId=${normalized.traceId}` : ''}`);
      setStatus('Failed to load files.');
    }
  }

  useEffect(() => {
    void loadFiles(parentId);
  }, [parentId]);

  async function runAction(title: string, action: () => Promise<unknown>, type: TaskRecord['type']) {
    setError(undefined);
    setStatus(title);
    try {
      const data = await action();
      await addTask({ type, status: 'success', title, data });
      setTasks((await readTasks()).slice(0, 5));
      setStatus('Done.');
      await loadFiles(parentId);
    } catch (caught) {
      const normalized = normalizeError(caught);
      await addTask({ type, status: 'failed', title, error: normalized });
      setError(`${normalized.message}${normalized.traceId ? ` traceId=${normalized.traceId}` : ''}`);
      setStatus('Failed.');
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
          onProgress: event => setStatus(`Uploading ${event.stage} ${event.percent.toFixed(1)}%`)
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
        setParentId(previous);
      }
    }
    if (key.return) {
      const current = files[selected];
      const fileId = getFileId(current);
      if (current?.type === 1 && fileId !== undefined) {
        setHistory(items => [...items, parentId]);
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
          return downloadToFile(info.downloadUrl, outputPath);
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

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color="cyan" bold>
        pan123 files
      </Text>
      <Text color="gray">
        parent={parentId} | enter open | h/backspace back | r refresh | u upload | m mkdir | d download | s share | l
        link | q quit
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {files.length === 0 ? <Text color="gray">(empty)</Text> : null}
        {files.map((file, index) => (
          <Text key={`${getFileId(file) ?? file.filename}-${index}`} color={index === selected ? 'cyan' : undefined}>
            {index === selected ? '>' : ' '} {file.type === 1 ? '[DIR] ' : '      '}
            {file.filename} <Text color="gray">{file.type === 1 ? '' : formatSize(file.size)}</Text>
          </Text>
        ))}
      </Box>
      {promptMode ? (
        <Box marginTop={1}>
          <Text>{promptMode === 'upload' ? 'Local file path: ' : 'Directory name: '}</Text>
          <TextInput value={promptValue} onChange={setPromptValue} onSubmit={submitPrompt} />
        </Box>
      ) : null}
      <Box flexDirection="column" marginTop={1}>
        <Text color={error ? 'red' : 'green'}>{error ?? status}</Text>
        {tasks.length ? <Text color="gray">Recent: {tasks.map(task => `${task.status}:${task.title}`).join(' | ')}</Text> : null}
      </Box>
    </Box>
  );
}
