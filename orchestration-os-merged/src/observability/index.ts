// Phase 10 — Observability: Metrics, Events, Dashboard Snapshot
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

interface MetricPoint {
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: number;
}

const eventLog: Array<{ type: string; data: unknown; timestamp: number }> = [];
const metricsLog: MetricPoint[] = [];
const logPath = '/tmp/zo-metrics.jsonl';
const eventsPath = '/tmp/zo-events.jsonl';

mkdirSync('/tmp', { recursive: true });

export function logEvent(type: string, data: unknown) {
  const event = { type, data, timestamp: Date.now() };
  eventLog.push(event);
  if (eventLog.length > 10000) eventLog.shift();
  const line = JSON.stringify(event) + '\n';
  writeFileSync(eventsPath, line, { flag: 'a' });
}

export function queryMetrics(name?: string, since?: number): MetricPoint[] {
  if (!existsSync(logPath)) return [];
  const lines = readFileSync(logPath, 'utf-8').trim().split('\n').filter(Boolean);
  let points = lines.map(l => {
    try { return JSON.parse(l) as MetricPoint; }
    catch { return null; }
  }).filter(Boolean) as MetricPoint[];
  if (name) points = points.filter(p => p.name === name);
  if (since) points = points.filter(p => p.timestamp >= since);
  return points.slice(-1000);
}

export function getDashboardSnapshot(): Record<string, unknown> {
  const recentEvents = eventLog.slice(-100);
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  return {
    timestamp: Date.now(),
    uptime: process.uptime(),
    memory: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024),
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system,
    },
    events: recentEvents.length,
    metricsPoints: metricsLog.length,
  };
}

export function prometheusMetrics(): string {
  const mem = process.memoryUsage();
  const lines = [
    '# HELP zo_uptime_seconds Uptime in seconds',
    '# TYPE zo_uptime_seconds gauge',
    `zo_uptime_seconds ${process.uptime()}`,
    '# HELP zo_memory_heap_used_bytes Heap memory used',
    '# TYPE zo_memory_heap_used_bytes gauge',
    `zo_memory_heap_used_bytes ${mem.heapUsed}`,
    '# HELP zo_memory_heap_total_bytes Total heap',
    '# TYPE zo_memory_heap_total_bytes gauge',
    `zo_memory_heap_total_bytes ${mem.heapTotal}`,
    '# HELP zo_events_total Total events logged',
    '# TYPE zo_events_total counter',
    `zo_events_total ${eventLog.length}`,
  ];
  return lines.join('\n') + '\n';
}
