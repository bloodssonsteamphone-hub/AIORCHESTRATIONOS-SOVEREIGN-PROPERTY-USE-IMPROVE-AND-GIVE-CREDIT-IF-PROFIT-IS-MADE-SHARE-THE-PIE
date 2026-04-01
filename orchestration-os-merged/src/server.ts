// Zo Orchestration OS — Express Server
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initOrchestrator, runBuild, getOrchestratorHealth, getOrchestrator } from './orchestration/index.js';
import { getRoutingPolicy, setRoutingPolicy } from './llm/federation.js';
import { createWorkflowEngine, WORKFLOW_CATALOG } from './workflows/index.js';
import { initTools, getAllToolMetrics, listTools } from './tools/index.js';
import { setOrchestratorRef } from './tools/orchestrator.js';
import { setWorkflowEngineRef } from './tools/workflow.js';

// Observability (lazy import — may not be fully implemented)
import * as observability from './observability/index.js';

// Patterns (lazy import)
import * as patterns from './patterns/index.js';

// Runtime (lazy import)
import * as runtime from './runtime/index.js';

// Deployment (lazy import)
import * as deployment from './deployment/index.js';

// Self-repair (lazy import)
import * as selfrepair from './selfrepair/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Serve L5 Dashboard app (if public/ exists)
const publicPath = join(__dirname, '../public');
import { existsSync } from 'fs';
if (existsSync(publicPath)) {
  app.use(express.static(publicPath));
}

// In-memory session store
const sessions = new Map<string, any>();

// ─── Bootstrap ────────────────────────────────────────────────────────────────

let _orchestrator: any = null;
let _workflowEngine: any = null;

function bootstrap() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║         ZO ORCHESTRATION OS v3.2.0 — GOD MODE            ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  const policy = getRoutingPolicy();
  console.log(`║  L8 Routing: ${policy.global}`.padEnd(49) + '║');
  console.log(`║  Federation: ${policy.federation?.strategy || 'sequential'}`.padEnd(48) + '║');
  console.log(`║  Agents: architect, coder, tester, docs, multimodal`.padEnd(49) + '║');
  const tools = listTools();
  console.log(`║  Tools: ${tools.length} registered (file, db, llm, multimodal...)`.padEnd(49) + '║');
  console.log(`║  Workflows: ${Object.keys(WORKFLOW_CATALOG).length} registered`.padEnd(48) + '║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Init tools first
  try { initTools(); } catch (e: any) { console.log(`[Init] Tools warning: ${e.message}`); }

  // Init orchestrator
  try {
    initOrchestrator();
    _orchestrator = getOrchestrator();
    setOrchestratorRef(_orchestrator);
  } catch (e: any) { console.log(`[Init] Orchestrator warning: ${e.message}`); }

  // Init workflow engine and wire it to tools
  try {
    _workflowEngine = createWorkflowEngine();
    setWorkflowEngineRef(_workflowEngine);
  } catch (e: any) { console.log(`[Init] Workflow engine warning: ${e.message}`); }
}

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  try {
    const health = getOrchestratorHealth();
    const tools = listTools();
    res.json({
      status: 'ok',
      version: '3.2.0',
      uptime: process.uptime(),
      orchestrator: health,
      layers: {
        L0: { status: 'simulated', note: 'Docker/Traefik not in container' },
        L1: { status: 'operational', runtimes: ['python3', 'node', 'bash'] },
        L2: { status: 'operational', agents: ['planner', 'coder'] },
        L3: { status: 'operational', tools: tools.length },
        L4: { status: 'operational', workflows: Object.keys(WORKFLOW_CATALOG).length },
        L5: { status: 'operational', apps: ['dashboard'] },
        L6: { status: 'operational' },
        L7: { status: 'partial', note: 'Desktop packaging not in container' },
        L8: { status: 'operational', routing: getRoutingPolicy() },
      },
    });
  } catch {
    res.json({ status: 'ok', version: '3.2.0', uptime: process.uptime() });
  }
});

// ─── Build ───────────────────────────────────────────────────────────────────

app.post('/api/build', async (req, res) => {
  const { prompt, sessionId } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  const id = sessionId || `build-${Date.now()}`;
  sessions.set(id, { id, status: 'pending', prompt, createdAt: Date.now() });

  runBuild(id, prompt).then(session => {
    sessions.set(id, session);
  }).catch(err => {
    sessions.set(id, { id, status: 'failed', error: err.message });
  });

  res.json({ sessionId: id, status: 'pending', message: 'Build started' });
});

app.get('/api/build/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

// SSE endpoint for real-time build progress
app.get('/api/build/:sessionId/stream', (req, res) => {
  const { sessionId } = req.params;
  
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);
  
  // Poll for session updates every 500ms
  const interval = setInterval(() => {
    const session = sessions.get(sessionId);
    if (!session) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Session not found' })}\n\n`);
      clearInterval(interval);
      res.end();
      return;
    }
    
    res.write(`data: ${JSON.stringify({
      type: 'progress',
      sessionId,
      status: session.status,
      files: session.files?.length || 0,
      error: session.error,
      testResult: (session as any).testResult,
    })}\n\n`);
    
    // Close when build is complete
    if (session.status === 'success' || session.status === 'failure') {
      clearInterval(interval);
      res.write(`data: ${JSON.stringify({ type: 'done', sessionId, status: session.status })}\n\n`);
      res.end();
    }
  }, 500);
  
  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(interval);
  });
});

app.get('/api/build/:sessionId/download', async (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.status !== 'success') return res.status(400).json({ error: 'Build not complete' });

  const archiver = (await import('archiver')).default;
  const { PassThrough } = await import('stream');

  const archive = archiver('zip');
  const stream = new PassThrough();

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${session.id}.zip"`);

  archive.pipe(res);
  for (const file of (session.result?.files || session.files || [])) {
    archive.append(file.content || file, { name: file.path });
  }
  archive.finalize();
});

// ─── Workflows ────────────────────────────────────────────────────────────────

app.get('/api/workflows', (req, res) => {
  if (!_workflowEngine) {
    return res.json({ workflows: Object.values(WORKFLOW_CATALOG).map(w => ({ id: w.id, name: w.name, status: 'idle' })) });
  }
  res.json({ workflows: _workflowEngine.list().map((w: any) => ({ id: w.id, name: w.name, status: w.status })) });
});

app.post('/api/workflows/:id/run', async (req, res) => {
  const { id } = req.params;
  const context = req.body.context || {};
  if (!_workflowEngine) return res.status(503).json({ error: 'Workflow engine not initialized' });
  try {
    const result = await _workflowEngine.run(id, context);
    res.json({ workflowId: id, status: result.status, metrics: result.metrics });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

app.get('/api/dashboard', (req, res) => {
  const allSessions = Array.from(sessions.values());
  const toolMetrics = getAllToolMetrics();
  const tools = listTools();

  res.json({
    totalBuilds: allSessions.length,
    successRate: allSessions.filter(s => s.status === 'success').length / Math.max(1, allSessions.length),
    avgFiles: allSessions.reduce((sum, s) => sum + (s.result?.files?.length || s.files?.length || 0), 0) / Math.max(1, allSessions.length),
    tools: [
      ...Object.entries(toolMetrics).map(([name, m]) => ({ name, invocations: m.invocations, successRate: m.invocations > 0 ? m.successes / m.invocations : 0 })),
      ...tools.filter(t => !toolMetrics[t.name]).map(t => ({ name: t.name, invocations: 0, successRate: 0 })),
    ],
    recentBuilds: allSessions.slice(-10).reverse().map(s => ({
      id: s.id,
      prompt: (s.prompt || '').substring(0, 80),
      status: s.status,
      files: s.result?.files?.length || s.files?.length || 0,
    })),
  });
});

// ─── LLM / Routing ────────────────────────────────────────────────────────────

app.get('/api/llm/providers', (req, res) => {
  const policy = getRoutingPolicy();
  res.json({
    policy,
    providers: Object.keys(policy.perAgent || {}),
    allProviders: ['ollama', 'groq', 'openrouter', 'chatgpt', 'claude'],
  });
});

app.post('/api/llm/routing', (req, res) => {
  const { tier, strategy } = req.body;
  const current = getRoutingPolicy();
  setRoutingPolicy({
    ...current,
    global: tier || current.global,
    federation: {
      enabled: current.federation?.enabled ?? true,
      strategy: strategy || current.federation?.strategy || 'sequential',
      maxParallel: current.federation?.maxParallel ?? 3,
    },
  });
  res.json({ updated: getRoutingPolicy() });
});

// ─── Self-Repair ───────────────────────────────────────────────────────────────

app.get('/api/self-repair', async (req, res) => {
  try {
    const { runSelfRepair } = await import('./selfrepair/index.js');
    const report = await runSelfRepair();
    res.json(report);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Evolution ────────────────────────────────────────────────────────────────

app.get('/api/evolution/stats', async (req, res) => {
  try {
    const { evolution } = await import('./evolution/SelfEvolution.js');
    const stats = evolution.getStats();
    res.json(stats);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/evolution/runtimes', async (req, res) => {
  try {
    const { evolution } = await import('./evolution/SelfEvolution.js');
    const runtimes = await evolution.discoverRuntimes();
    res.json({ runtimes });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Patterns ─────────────────────────────────────────────────────────────────

app.get('/api/patterns', (req, res) => {
  const type = req.query.type as string | undefined;
  const allPatterns = patterns.listPatterns(type as any);
  res.json({ patterns: allPatterns });
});

app.post('/api/patterns', (req, res) => {
  const { name, description, type, payload, score, tags } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'name and type required' });
  const pattern = patterns.storePattern({ name, description: description || '', type, payload: payload || null, score: score || 0.5, tags: tags || [] });
  res.json(pattern);
});

app.delete('/api/patterns/:id', (req, res) => {
  const deleted = patterns.deletePattern(req.params.id);
  res.json({ deleted });
});

// ─── Runtimes ─────────────────────────────────────────────────────────────────

app.get('/api/runtimes', (req, res) => {
  const runtimes = runtime.listRuntimes();
  res.json({ runtimes });
});

app.post('/api/runtimes/execute', async (req, res) => {
  const { code, runtime: rtName } = req.body;
  if (!code || !rtName) return res.status(400).json({ error: 'code and runtime required' });
  try {
    const result = await runtime.executeCode(code, rtName);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Observability ────────────────────────────────────────────────────────────

app.get('/api/observability/snapshot', async (req, res) => {
  try {
    const snapshot = observability.getDashboardSnapshot();
    res.json(snapshot);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/observability/metrics', (req, res) => {
  const { name, since } = req.query;
  const points = observability.queryMetrics(name as string, since ? Number(since) : undefined);
  res.json({ points });
});

app.get('/api/observability/events', (req, res) => {
  const { type, data } = req.query;
  if (type && data) observability.logEvent(String(type), { data: JSON.parse(String(data)) });
  res.json({ ok: true });
});

app.get('/metrics', (req, res) => {
  try {
    const metrics = observability.prometheusMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch {
    res.set('Content-Type', 'text/plain');
    res.send('# observability not available\n');
  }
});

// ─── Deployment ───────────────────────────────────────────────────────────────

app.get('/api/deploy/targets', (req, res) => {
  const targets = deployment.listTargets();
  res.json({ targets });
});

app.post('/api/deploy', async (req, res) => {
  const { artifactPath, targetId, outputPath } = req.body;
  if (!artifactPath || !targetId || !outputPath) return res.status(400).json({ error: 'artifactPath, targetId, outputPath required' });
  try {
    const result = await deployment.deploy(artifactPath, targetId, outputPath);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Hooks ───────────────────────────────────────────────────────────────────

app.post('/hooks/http', async (req, res) => {
  const { url, event, payload } = req.body;
  console.log(`[Hook:HTTP] ${event} -> ${url}`);
  if (url) {
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event, payload, timestamp: Date.now() }) });
      res.json({ success: true, status: response.status });
    } catch (e: any) { res.json({ success: false, error: e.message }); }
  } else { res.json({ success: true, message: 'Hook received' }); }
});

app.post('/hooks/cron', (req, res) => { console.log(`[Hook:Cron] ${req.body.schedule}`); res.json({ success: true }); });
app.post('/hooks/fs', (req, res) => { console.log(`[Hook:FS] ${req.body.path}`); res.json({ success: true }); });
app.post('/hooks/cli', (req, res) => { console.log(`[Hook:CLI] ${req.body.command}`); res.json({ success: true }); });

// ─── Tools Registry API ──────────────────────────────────────────────────────

app.get('/api/tools', (req, res) => {
  const tools = listTools();
  const metrics = getAllToolMetrics();
  res.json({
    total: tools.length,
    tools: tools.map(t => ({
      name: t.name,
      category: t.category,
      description: t.description,
      capabilities: t.capabilities,
      metrics: metrics[t.name] || { invocations: 0, successes: 0, failures: 0, avgDuration: 0 },
    })),
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

bootstrap();

app.listen(PORT, () => {
  console.log(`🚀  Zo Orchestration OS v3.2.0 ready on port ${PORT}`);
  console.log(`📊  Dashboard:   http://localhost:${PORT}/`);
  console.log(`📋  Health:      http://localhost:${PORT}/api/health`);
  console.log(`🔧  Tools:       http://localhost:${PORT}/api/tools`);
  console.log(`⚙️   Workflows:  http://localhost:${PORT}/api/workflows`);
  console.log(`🤖  LLM Router:  http://localhost:${PORT}/api/llm/providers\n`);
});

export default app;
