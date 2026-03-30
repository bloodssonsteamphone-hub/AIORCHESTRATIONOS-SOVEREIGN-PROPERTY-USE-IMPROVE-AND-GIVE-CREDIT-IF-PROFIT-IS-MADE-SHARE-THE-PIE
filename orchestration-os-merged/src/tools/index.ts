// Layer 3 — Tool Registry + Concrete Tool Implementations
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { spawn } from 'child_process';
import type { Tool, ToolCategory, ToolResult, ToolMetrics, ToolRegistry } from '../types.js';
import { dbTool, pgTool } from './db.js';
import { llmTool, llmFederationTool } from './llm.js';
import { imageGenTool, imageEditTool, audioTranscribeTool, audioSpeakTool, videoExtractFramesTool } from './multimodal.js';
import { orchestratorTool } from './orchestrator.js';
import { workflowTool } from './workflow.js';

// ─── Registry ─────────────────────────────────────────────────────────────────

const registry = new Map<string, Tool>();
const metrics: Record<string, ToolMetrics> = {};

function makeMetrics(): ToolMetrics {
  return { invocations: 0, successes: 0, failures: 0, avgDuration: 0 };
}

function recordInvocation(name: string, success: boolean, duration: number) {
  const m = metrics[name] ?? (metrics[name] = makeMetrics());
  m.invocations++;
  if (success) m.successes++; else m.failures++;
  m.avgDuration = (m.avgDuration * (m.invocations - 1) + duration) / m.invocations;
  m.lastUsed = Date.now();
}

export function registerTool(tool: Tool) {
  registry.set(tool.name, tool);
  metrics[tool.name] ??= makeMetrics();
}

export function getTool(name: string): Tool | undefined {
  return registry.get(name);
}

export function listTools(category?: ToolCategory): Tool[] {
  const all = Array.from(registry.values());
  return category ? all.filter(t => t.category === category) : all;
}

export async function invokeTool(name: string, params: Record<string, unknown>): Promise<ToolResult> {
  const tool = registry.get(name);
  if (!tool) return { success: false, error: `Tool not found: ${name}`, duration: 0 };
  const start = Date.now();
  try {
    const result = await tool.invoke(params);
    recordInvocation(name, result.success, Date.now() - start);
    return result;
  } catch (e: any) {
    recordInvocation(name, false, Date.now() - start);
    return { success: false, error: e.message, duration: Date.now() - start };
  }
}

export function getToolMetrics(name: string): ToolMetrics | undefined {
  return metrics[name];
}

export function getAllToolMetrics(): Record<string, ToolMetrics> {
  return { ...metrics };
}

// ─── FileTool ──────────────────────────────────────────────────────────────────

function makeFileTool(): Tool {
  return {
    name: 'file',
    category: 'filesystem',
    description: 'Read, write, list, delete files on the workspace filesystem',
    capabilities: ['read', 'write', 'list', 'delete', 'exists', 'mkdir'],
    metrics: metrics['file'] ?? makeMetrics(),
    invoke: async (params) => {
      const { action, path, content, target } = params as { action: string; path?: string; content?: string; target?: string };
      const start = Date.now();
      try {
        switch (action) {
          case 'read': {
            if (!path) throw new Error('path required');
            const c = readFileSync(path, 'utf-8');
            return { success: true, data: c, duration: Date.now() - start };
          }
          case 'write': {
            if (!path || content === undefined) throw new Error('path and content required');
            mkdirSync(dirname(path), { recursive: true });
            writeFileSync(path, content);
            return { success: true, data: path, duration: Date.now() - start };
          }
          case 'list': {
            if (!path) throw new Error('path required');
            const entries = readdirSync(path);
            return { success: true, data: entries, duration: Date.now() - start };
          }
          case 'delete': {
            if (!path) throw new Error('path required');
            rmSync(path, { recursive: true, force: true });
            return { success: true, data: path, duration: Date.now() - start };
          }
          case 'exists': {
            if (!path) throw new Error('path required');
            return { success: true, data: existsSync(path), duration: Date.now() - start };
          }
          case 'mkdir': {
            if (!path) throw new Error('path required');
            mkdirSync(path, { recursive: true });
            return { success: true, data: path, duration: Date.now() - start };
          }
          case 'copy': {
            if (!path || !target) throw new Error('path and target required');
            const c = readFileSync(path);
            mkdirSync(dirname(target), { recursive: true });
            writeFileSync(target, c);
            return { success: true, data: target, duration: Date.now() - start };
          }
          case 'stat': {
            if (!path) throw new Error('path required');
            const s = statSync(path);
            return { success: true, data: { size: s.size, mtime: s.mtime, isDir: s.isDirectory() }, duration: Date.now() - start };
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      } catch (e: any) {
        return { success: false, error: e.message, duration: Date.now() - start };
      }
    },
  };
}

// ─── TestRunnerTool ───────────────────────────────────────────────────────────

function makeTestRunnerTool(): Tool {
  return {
    name: 'test-runner',
    category: 'execution',
    description: 'Run test suites using Jest, Vitest, or pytest',
    capabilities: ['jest', 'vitest', 'pytest', 'npm-test'],
    metrics: metrics['test-runner'] ?? makeMetrics(),
    invoke: async (params) => {
      const { cwd, framework, pattern } = params as { cwd?: string; framework?: string; pattern?: string };
      const start = Date.now();
      const workDir = cwd || process.cwd();
      try {
        let cmd: string[], args: string[];
        switch (framework) {
          case 'jest':
          case 'vitest':
            cmd = ['npx', framework === 'jest' ? 'jest' : 'vitest', 'run'];
            if (pattern) cmd.push('--testPathPattern', pattern);
            break;
          case 'pytest':
            cmd = ['python3', '-m', 'pytest'];
            if (pattern) cmd.push('-k', pattern);
            break;
          default:
            cmd = ['npm', 'test'];
        }
        const result = await execAsync(cmd[0], cmd.slice(1), { cwd: workDir });
        return { success: result.exitCode === 0, data: result.stdout, duration: Date.now() - start };
      } catch (e: any) {
        return { success: false, error: e.message, duration: Date.now() - start };
      }
    },
  };
}

// ─── ZipBundlerTool ────────────────────────────────────────────────────────────

function makeZipBundlerTool(): Tool {
  return {
    name: 'zip-bundler',
    category: 'filesystem',
    description: 'Package files or directories into a zip archive',
    capabilities: ['create-zip', 'extract-zip', 'list-contents'],
    metrics: metrics['zip-bundler'] ?? makeMetrics(),
    invoke: async (params) => {
      const { action, source, output, target } = params as { action: string; source?: string; output?: string; target?: string };
      const start = Date.now();
      try {
        switch (action) {
          case 'create-zip': {
            if (!source || !output) throw new Error('source and output required');
            const { default: archiver } = await import('archiver');
            const { createWriteStream } = await import('fs');
            await new Promise<void>((res, rej) => {
              const archive = archiver('zip');
              const stream = createWriteStream(output);
              stream.on('close', res);
              archive.on('error', rej);
              archive.directory(source, false).pipe(stream);
              archive.finalize();
            });
            return { success: true, data: output, duration: Date.now() - start };
          }
          case 'extract-zip': {
            if (!source || !target) throw new Error('source and target required');
            await execAsync('unzip', ['-o', source, '-d', target], {});
            return { success: true, data: target, duration: Date.now() - start };
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      } catch (e: any) {
        return { success: false, error: e.message, duration: Date.now() - start };
      }
    },
  };
}

// ─── MetricsTool ───────────────────────────────────────────────────────────────

function makeMetricsTool(): Tool {
  return {
    name: 'metrics',
    category: 'orchestrator',
    description: 'Log and query metrics from the observability layer',
    capabilities: ['log', 'query', 'summary'],
    metrics: metrics['metrics'] ?? makeMetrics(),
    invoke: async (params) => {
      const { action, metric, value, tags } = params as { action: string; metric?: string; value?: unknown; tags?: Record<string, string> };
      const start = Date.now();
      try {
        switch (action) {
          case 'log': {
            if (!metric) throw new Error('metric name required');
            const entry = { metric, value, tags, ts: Date.now() };
            // Append to metrics log file
            const logPath = '/tmp/zo-metrics.jsonl';
            const line = JSON.stringify(entry) + '\n';
            mkdirSync('/tmp', { recursive: true });
            writeFileSync(logPath, line, { flag: 'a' });
            return { success: true, data: entry, duration: Date.now() - start };
          }
          case 'query': {
            // Read recent metrics log
            const logPath = '/tmp/zo-metrics.jsonl';
            if (!existsSync(logPath)) return { success: true, data: [], duration: Date.now() - start };
            const lines = readFileSync(logPath, 'utf-8').trim().split('\n').filter(Boolean);
            const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
            const filtered = metric ? entries.filter((e: any) => e.metric === metric) : entries;
            return { success: true, data: filtered.slice(-100), duration: Date.now() - start };
          }
          case 'summary': {
            const toolMetrics = getAllToolMetrics();
            return { success: true, data: toolMetrics, duration: Date.now() - start };
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      } catch (e: any) {
        return { success: false, error: e.message, duration: Date.now() - start };
      }
    },
  };
}

// ─── HTTPTool ─────────────────────────────────────────────────────────────────

function makeHTTPTool(): Tool {
  return {
    name: 'http',
    category: 'http',
    description: 'Make HTTP requests to external services',
    capabilities: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    metrics: metrics['http'] ?? makeMetrics(),
    invoke: async (params) => {
      const { method, url, headers, body } = params as { method?: string; url: string; headers?: Record<string, string>; body?: unknown };
      const start = Date.now();
      try {
        const res = await fetch(url, {
          method: method || 'GET',
          headers: headers || { 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
        });
        const text = await res.text();
        return {
          success: res.ok,
          data: { status: res.status, body: text, headers: Object.fromEntries(res.headers.entries()) },
          duration: Date.now() - start,
        };
      } catch (e: any) {
        return { success: false, error: e.message, duration: Date.now() - start };
      }
    },
  };
}

// ─── Register All Tools ────────────────────────────────────────────────────────

export function initTools() {
  // Layer 3 — filesystem + execution
  registerTool(makeFileTool());
  registerTool(makeTestRunnerTool());
  registerTool(makeZipBundlerTool());
  registerTool(makeMetricsTool());
  registerTool(makeHTTPTool());
  // Layer 3 — db.*
  registerTool(dbTool);
  registerTool(pgTool);
  // Layer 3 — llm.*
  registerTool(llmTool);
  registerTool(llmFederationTool);
  // Layer 3 — multimodal.*
  registerTool(imageGenTool);
  registerTool(imageEditTool);
  registerTool(audioTranscribeTool);
  registerTool(audioSpeakTool);
  registerTool(videoExtractFramesTool);
  // Layer 3 — orchestrator.*
  registerTool(orchestratorTool);
  // Layer 3 — workflow.*
  registerTool(workflowTool);
  console.log(`[Tools] Registered ${registry.size} tools: ${Array.from(registry.keys()).join(', ')}`);
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function execAsync(cmd: string, args: string[], opts: { cwd?: string }): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd: opts.cwd });
    let stdout = '', stderr = '';
    proc.stdout?.on('data', d => stdout += d.toString());
    proc.stderr?.on('data', d => stderr += d.toString());
    proc.on('close', code => resolve({ stdout, stderr, exitCode: code || 0 }));
    proc.on('error', e => resolve({ stdout, stderr, exitCode: 1 }));
  });
}
