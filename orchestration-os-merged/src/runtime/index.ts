// Phase 1/10 — Multi-Runtime Executor (L1)
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface Runtime {
  id: string;
  name: string;
  extensions: string[];
  executor: (code: string, cwd?: string) => Promise<RuntimeResult>;
}

export interface RuntimeResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

function execCmd(cmd: string, args: string[], cwd?: string): Promise<RuntimeResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    const proc = spawn(cmd, args, { cwd: cwd || '/tmp', shell: false });
    let stdout = '', stderr = '';
    proc.stdout?.on('data', d => { stdout += d.toString(); });
    proc.stderr?.on('data', d => { stderr += d.toString(); });
    proc.on('close', code => {
      resolve({ success: code === 0, stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code || 0, durationMs: Date.now() - start });
    });
    proc.on('error', e => {
      resolve({ success: false, stdout, stderr: e.message, exitCode: 1, durationMs: Date.now() - start });
    });
  });
}

const runtimes: Record<string, Runtime> = {
  python: {
    id: 'python', name: 'Python 3', extensions: ['.py'],
    executor: (code, cwd) => execCmd('python3', ['-c', code], cwd),
  },
  node: {
    id: 'node', name: 'Node.js', extensions: ['.js', '.mjs'],
    executor: (code, cwd) => execCmd('node', ['--input-type=module', '-e', code], cwd),
  },
  bash: {
    id: 'bash', name: 'Bash', extensions: ['.sh', '.bash'],
    executor: (code, cwd) => execCmd('bash', ['-c', code], cwd),
  },
  deno: {
    id: 'deno', name: 'Deno', extensions: ['.ts', '.js'],
    executor: (code, cwd) => execCmd('deno', ['eval', code], cwd),
  },
  bun: {
    id: 'bun', name: 'Bun', extensions: ['.ts', '.js'],
    executor: (code, cwd) => execCmd('bun', ['-e', code], cwd),
  },
};

export async function executeFromFile(runtimeId: string, filePath: string, cwd?: string): Promise<RuntimeResult> {
  const runtime = runtimes[runtimeId];
  if (!runtime) throw new Error(`Unknown runtime: ${runtimeId}`);
  let cmd: string, args: string[];
  switch (runtimeId) {
    case 'python': cmd = 'python3'; args = [filePath]; break;
    case 'node':   cmd = 'node';    args = [filePath]; break;
    case 'bash':   cmd = 'bash';    args = [filePath]; break;
    case 'deno':   cmd = 'deno';   args = ['run', filePath]; break;
    case 'bun':    cmd = 'bun';     args = [filePath]; break;
    default:       cmd = 'node';    args = [filePath]; break;
  }
  return execCmd(cmd, args, cwd);
}

export async function executeCode(code: string, runtimeId: string, cwd?: string): Promise<RuntimeResult> {
  const runtime = runtimes[runtimeId];
  if (!runtime) throw new Error(`Unknown runtime: ${runtimeId}`);
  const ext = runtime.extensions[0] || '.txt';
  const tmpDir = '/tmp/zo-runtime';
  mkdirSync(tmpDir, { recursive: true });
  const tmpFile = join(tmpDir, `zo-${Date.now()}${ext}`);
  writeFileSync(tmpFile, code);
  const result = await executeFromFile(runtimeId, tmpFile, cwd);
  try { unlinkSync(tmpFile); } catch { /* ignore */ }
  return result;
}

export function detectRuntime(filePath: string): Runtime | undefined {
  for (const rt of Object.values(runtimes)) {
    if (rt.extensions.some(ext => filePath.endsWith(ext))) return rt;
  }
  return undefined;
}

export function listRuntimes(): Runtime[] { return Object.values(runtimes); }
export function getRuntime(id: string): Runtime | undefined { return runtimes[id]; }
export { runtimes };
