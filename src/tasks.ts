import { readFile, writeFile } from 'node:fs/promises';
import { ensureDataFiles } from './config.js';
import { tasksPath } from './paths.js';

export interface TaskRecord {
  id: string;
  type: 'upload' | 'download' | 'share' | 'direct-link' | 'mkdir';
  status: 'success' | 'failed' | 'running';
  title: string;
  createdAt: string;
  data?: unknown;
  error?: unknown;
}

export async function readTasks(): Promise<TaskRecord[]> {
  await ensureDataFiles();
  try {
    const value = JSON.parse(await readFile(tasksPath(), 'utf8')) as unknown;
    return Array.isArray(value) ? (value as TaskRecord[]) : [];
  } catch {
    return [];
  }
}

export async function addTask(task: Omit<TaskRecord, 'id' | 'createdAt'>): Promise<TaskRecord> {
  const tasks = await readTasks();
  const record: TaskRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...task
  };
  const next = [record, ...tasks].slice(0, 100);
  await writeFile(tasksPath(), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return record;
}
