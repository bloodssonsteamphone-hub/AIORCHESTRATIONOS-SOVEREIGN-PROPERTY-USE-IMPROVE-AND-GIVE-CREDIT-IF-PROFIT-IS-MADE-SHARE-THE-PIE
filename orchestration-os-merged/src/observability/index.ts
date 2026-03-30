// Phase 8 — Observability & Metrics Engine
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';

export interface MetricPoint {
  name: string;
  value: number;
  tags: Record<string, string>;
  ts: number;
}

export interface DashboardSnapshot {
  llmUsage: LLMUsageSummary;
  workflowHealth: WorkflowHealthSummary;
  toolMetrics: ToolMetricsSummary;
  systemHealth: SystemHealthSummary;
}

export interface LLMUsageSummary {
  totalCalls: number;
  byProvider: Record<string, { calls: number; avgLatencyMs: number; successRate: number; cost: number }>;
  byTier: Record<string, number>;
}

export interface WorkflowHealthSummary {
  totalRuns: number;
  byWorkflow: Record<string, { runs: number; successRate: number; avgDurationMs: number }>;
}

export interface ToolMetricsSummary {
  byTool: Record<string, { invocations: number; successRate: number; avgDurationMs: number; lastUsed: number }>;
}

export interface SystemHealthSummary {
  uptime: number;
  memoryUsageMb: number;
  activeSessions: number;
}

const metricsLogPath = '/tmp/zo-metrics.jsonl';
const eventsLogPath = '/tmp/zo-events.jsonl';

function ensureLogFiles() {
  mkdirSync('/tmp', { recursive: true });
  if (!existsSync(metricsLogPath)) writeFileSync(metricsLogPath, '');
  if (!existsSync(eventsLogPath)) writeFileSync(eventsLogPath, '');
}

// ─── Event logging ─────────────────────────────────────────────────────────────

export function logEvent(type: string, data: Record<string, unknown>) {
  ensureLogFiles();
  const entry = { type, ...data, ts: Date.now() };
  writeFileSync(eventsLogPath, JSON.stringify(entry) + '\n', { flag: 'a' });
}

// ─── Metric logging ───────────────────────────────────────────────────────────

export function logMetric(name: string, value: number, tags: Record<string, string> = {}) {
  ensureLogFiles();
  const point: MetricPoint = { name, value, tags, ts: Date.now() };
  writeFileSync(metricsLogPath, JSON.stringify(point) + '\n', { flag: 'a' });
}

// ─── Query metrics ─────────────────────────────────────────────────────────────

export function queryMetrics(name?: string, since?: number): MetricPoint[] {
  ensureLogFiles();
  if (!existsSync(metricsLogPath)) return [];
  const lines = readFileSync(metricsLogPath, 'utf-8').trim().split('\n').filter(Boolean);
  const cutoff = since || 0;
  return lines
    .map(l => { try { return JSON.parse(l) as MetricPoint; } catch { return null; } })
    .filter((m): m is MetricPoint => m !== null && (cutoff === 0 || m.ts >= cutoff))
    .filter(m => !name || m.name === name);
}

// ─── Dashboard Snapshot ────────────────────────────────────────────────────────

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const oneHourAgo = Date.now() - 3600000;

  // LLM usage from events
  const events = getRecentEvents(oneHourAgo);
  const llmCalls = events.filter(e => e.type === 'llm-call');
  const llmUsage: LLMUsageSummary = { totalCalls: llmCalls.length, byProvider: {}, byTier: {} };
  for (const e of llmCalls) {
    const p = (e.data as any)?.provider || 'unknown';
    const tier = (e.data as any)?.tier || 'unknown';
    if (!llmUsage.byProvider[p]) llmUsage.byProvider[p] = { calls: 0, avgLatencyMs: 0, successRate: 0, cost: 0 };
    llmUsage.byProvider[p].calls++;
    llmUsage.byProvider[p].avgLatencyMs += ((e.data as any)?.latencyMs || 0);
    llmUsage.byTier[tier] = (llmUsage.byTier[tier] || 0) + 1;
  }
  for (const p of Object.keys(llmUsage.byProvider)) {
    const d = llmUsage.byProvider[p];
    d.avgLatencyMs = d.calls > 0 ? Math.round(d.avgLatencyMs / d.calls) : 0;
  }

  // Tool metrics from tool registry
  const { getAllToolMetrics } = await import('../tools/index.js');
  const toolMetrics = getAllToolMetrics();
  const toolSummary: ToolMetricsSummary = { byTool: {} };
  for (const [name, m] of Object.entries(toolMetrics)) {
    toolSummary.byTool[name] = {
      invocations: m.invocations,
      successRate: m.invocations > 0 ? Math.round((m.successes / m.invocations) * 100) / 100 : 0,
      avgDurationMs: Math.round(m.avgDuration),
      lastUsed: m.lastUsed || 0,
    };
  }

  // Workflow health from workflow catalog
  const { WORKFLOW_CATALOG } = await import('../workflows/index.js');
  const wfHealth: WorkflowHealthSummary = { totalRuns: 0, byWorkflow: {} };
  for (const [id, entry] of Object.entries(WORKFLOW_CATALOG)) {
    const wf = entry as any;
    const runs = wf.metrics?.totalRuns || 0;
    wfHealth.totalRuns += runs;
    wfHealth.byWorkflow[id] = {
      runs,
      successRate: wf.metrics?.successRate || 0,
      avgDurationMs: Math.round(wf.metrics?.avgDuration || 0),
    };
  }

  // System health
  const memUsage = process.memoryUsage();
  const { getOrchestrator } = await import('../orchestration/orchestrator.js');
  const orch = getOrchestrator();
  const sysHealth: SystemHealthSummary = {
    uptime: Date.now() - (orch.state.lastHealthCheck || Date.now()),
    memoryUsageMb: Math.round(memUsage.heapUsed / 1024 / 1024),
    activeSessions: orch.state.activeSessions,
  };

  return { llmUsage, workflowHealth: wfHealth, toolMetrics: toolSummary, systemHealth: sysHealth };
}

function getRecentEvents(since: number): Array<{ type: string; data: unknown; ts: number }> {
  ensureLogFiles();
  if (!existsSync(eventsLogPath)) return [];
  const lines = readFileSync(eventsLogPath, 'utf-8').trim().split('\n').filter(Boolean);
  return lines
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter((e): e is { type: string; data: unknown; ts: number } => e !== null && e.ts >= since);
}

// ─── Prometheus-compatible metrics endpoint ──────────────────────────────────

export function prometheusMetrics(): string {
  const points = queryMetrics();
  const lines: string[] = ['# HELP zo_metric General metrics', '# TYPE zo_metric gauge'];

  // Group by name
  const grouped: Record<string, MetricPoint[]> = {};
  for (const p of points) {
    grouped[p.name] ??= [];
    grouped[p.name].push(p);
  }

  for (const [name, pts] of Object.entries(grouped)) {
    const latest = pts.sort((a, b) => b.ts - a.ts)[0];
    const tagStr = Object.entries(latest.tags).map(([k, v]) => `${k}="${v}"`).join(',');
    lines.push(`zo_metric{name="${name}",${tagStr}} ${latest.value}`);
  }

  return lines.join('\n');
}
