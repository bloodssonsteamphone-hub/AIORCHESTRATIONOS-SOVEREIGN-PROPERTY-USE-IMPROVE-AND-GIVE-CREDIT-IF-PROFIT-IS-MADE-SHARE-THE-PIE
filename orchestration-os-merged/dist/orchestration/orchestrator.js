import { initTools, getAllToolMetrics, listTools } from '../tools/index.js';
import { createWorkflowEngine, WORKFLOW_CATALOG } from '../workflows/index.js';
import { createBrainSystem, makeDecision, getPrimaryBrain } from '../brains/index.js';
import { getRoutingPolicy } from '../llm/federation.js';
const config = {
    sessionTimeout: 600000,
    maxParallelAgents: 4,
    toolTimeout: 30000,
    llmTimeout: 60000,
    routingPolicy: getRoutingPolicy(),
    failoverPolicy: {
        triggers: ['healthcheck-fail', 'latency-spike', 'panic-error'],
        actions: ['promote-backup', 'spawn-new-backup', 'alert-operator'],
        autoPromote: true,
    },
    selfRepairEnabled: true,
    blueprintHotReload: false,
};
let orchestratorState = {
    status: 'initializing',
    activeSessions: 0,
    activeAgents: 0,
    queueDepth: 0,
    lastHealthCheck: Date.now(),
};
const sessions = new Map();
const hooks = [];
export function getOrchestrator() {
    return {
        config,
        state: orchestratorState,
        sessions,
        hooks,
        status: orchestratorState.status,
        reloadBlueprint: () => { console.log('[Orchestrator] Blueprint hot-reload triggered'); },
    };
}
function initOrchestrator() {
    initTools();
    createBrainSystem();
    createWorkflowEngine();
    orchestratorState.status = 'ready';
    console.log('[Orchestrator] ✅ Fully initialized');
    console.log(`[Orchestrator] Tools: ${listTools().length} registered`);
    console.log(`[Orchestrator] Workflows: ${Object.keys(WORKFLOW_CATALOG).length} catalog`);
}
async function runBuild(sessionId, prompt) {
    const session = {
        id: sessionId,
        prompt,
        status: 'running',
        createdAt: Date.now(),
        phase: 'planning',
    };
    sessions.set(sessionId, session);
    orchestratorState.activeSessions++;
    console.log(`\n[Orchestrator] Build ${sessionId}: "${prompt.substring(0, 60)}..."`);
    try {
        const { routing, agents, tools } = await makeDecision({ task: prompt });
        console.log(`[Orchestrator] Routing: ${routing} | Agents: ${agents.join(', ')} | Tools: ${tools.join(', ')}`);
        session.phase = 'architect';
        const { runBuild: agentRun } = await import('../agents/index.js');
        const agentResult = await agentRun(sessionId, prompt);
        const normalizedStatus = agentResult.status === 'failure' ? 'failed' :
            agentResult.status === 'success' ? 'success' :
                agentResult.status === 'running' ? 'running' : 'failed';
        session.result = {
            files: agentResult.files.map((f) => ({
                path: f.path,
                content: f.content,
                type: inferFileType(f.path),
            })),
            plan: `Built with ${agents.join(', ')}`,
            runtime: routing,
        };
        session.status = normalizedStatus;
        session.phase = normalizedStatus === 'success' ? 'complete' : 'failed';
        session.duration = Date.now() - session.createdAt;
        if (agentResult.error)
            session.error = agentResult.error;
    }
    catch (e) {
        session.status = 'failed';
        session.error = e.message;
        session.phase = 'failed';
        console.log(`[Orchestrator] Build failed: ${e.message}`);
    }
    orchestratorState.activeSessions--;
    return sessions.get(sessionId);
}
function inferFileType(path) {
    if (/(\.test\.|\.spec\.)(ts|js)$/.test(path))
        return 'test';
    if (/\.(md|txt)$/.test(path))
        return 'docs';
    if (/\.(json|yaml|yml|toml)$/.test(path))
        return 'config';
    if (/\.(jsx?|tsx?)$/.test(path))
        return 'frontend';
    if (/\.(py|go|rs|java|rb)$/.test(path))
        return 'backend';
    if (/\.(ts|js)$/.test(path) && !path.includes('test'))
        return 'backend';
    return 'frontend';
}
function getOrchestratorHealth() {
    const components = {};
    const toolMetrics = getAllToolMetrics();
    const toolsUp = Object.keys(toolMetrics).length;
    components.tools = { status: toolsUp > 0 ? 'up' : 'degraded', lastCheck: Date.now() };
    const primary = getPrimaryBrain();
    components.brain = {
        status: primary.status === 'active' ? 'up' : primary.status === 'standby' ? 'degraded' : 'down',
        lastCheck: Date.now(),
    };
    components.memory = { status: 'up', lastCheck: Date.now() };
    components.orchestrator = { status: 'up', lastCheck: Date.now() };
    const allUp = Object.values(components).every(c => c.status === 'up');
    const anyDown = Object.values(components).some(c => c.status === 'down');
    return {
        status: allUp ? 'healthy' : anyDown ? 'unhealthy' : 'degraded',
        components,
        uptime: Date.now() - (orchestratorState.lastHealthCheck ?? Date.now()),
    };
}
function getSession(id) { return sessions.get(id); }
function getHooks() { return [...hooks]; }
function registerHook(hook) { hooks.push(hook); }
async function triggerHooks(event, payload) {
    for (const hook of hooks) {
        if (hook.type === 'http' && hook.config.url) {
            try {
                await fetch(hook.config.url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ event, payload, timestamp: Date.now() }),
                });
            }
            catch { /* fire-and-forget */ }
        }
        if (hook.type === 'cron' || hook.type === 'fs' || hook.type === 'cli') {
            console.log(`[Hook:${hook.type}] ${event}`);
        }
    }
}
function updateConfig(patch) { Object.assign(config, patch); }
function getConfig() { return config; }
let blueprintWatchInterval = null;
function startBlueprintWatch(path) {
    let lastMtime = 0;
    blueprintWatchInterval = setInterval(async () => {
        try {
            const { statSync } = await import('fs');
            const stats = statSync(path);
            if (stats.mtimeMs > lastMtime) {
                lastMtime = stats.mtimeMs;
                console.log(`[Blueprint] Detected change in ${path}, reloading...`);
                await triggerHooks('blueprint.reload', { path, mtime: lastMtime });
            }
        }
        catch { /* ignore */ }
    }, 5000);
}
export { runBuild, initOrchestrator, getOrchestratorHealth, getSession, getHooks, registerHook, triggerHooks, updateConfig, getConfig, startBlueprintWatch };
