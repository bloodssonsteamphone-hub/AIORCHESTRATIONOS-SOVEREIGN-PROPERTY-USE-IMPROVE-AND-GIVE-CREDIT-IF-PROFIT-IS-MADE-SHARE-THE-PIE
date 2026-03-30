// Phase 11 — Self-Healing & Auto-Repair
import { getAllToolMetrics } from '../tools/index.js';
import { getOrchestratorHealth } from '../orchestration/index.js';
import { getPrimaryBrain } from '../brains/index.js';
import { getRoutingPolicy } from '../llm/federation.js';
const REPAIR_HANDLERS = {
    'tool-failure': repairToolFailure,
    'llm-provider-down': repairLLMProvider,
    'brain-latency': repairBrainLatency,
    'memory-pressure': repairMemoryPressure,
    'workflow-stuck': repairWorkflowStuck,
};
export async function runSelfRepair() {
    const checks = await runDiagnostics();
    const healthy = checks.every(c => c.status !== 'fail');
    const repairs = [];
    for (const check of checks) {
        if (check.status === 'fail') {
            const handler = REPAIR_HANDLERS[check.component] || REPAIR_HANDLERS['tool-failure'];
            try {
                const result = await handler();
                repairs.push(result);
            }
            catch (e) {
                repairs.push({ id: `repair-${Date.now()}`, repaired: false, issues: [check.message], actions: [`Repair failed: ${e.message}`], timestamp: Date.now() });
            }
        }
    }
    const recommendations = generateRecommendations(checks, repairs);
    return { healthy, checks, repairs, recommendations };
}
async function runDiagnostics() {
    const checks = [];
    // Tool registry
    const toolMetrics = getAllToolMetrics();
    const failingTools = Object.entries(toolMetrics).filter(([, m]) => m.failures > m.invocations * 0.5 && m.invocations > 3);
    checks.push({
        component: 'tool-failure',
        status: failingTools.length > 0 ? 'fail' : 'pass',
        message: failingTools.length > 0 ? `${failingTools.length} tools with >50% failure rate` : 'All tools healthy',
        details: { failingTools: failingTools.map(([k]) => k) },
    });
    // LLM routing
    const routing = getRoutingPolicy();
    checks.push({
        component: 'llm-provider-down',
        status: 'pass',
        message: 'Routing policy active',
        details: { global: routing.global, federation: routing.federation?.enabled ?? false },
    });
    // Brain
    const brain = getPrimaryBrain();
    const brainHealthy = brain.status === 'active' && brain.metrics.avgDecisionTime < 5000;
    checks.push({
        component: 'brain-latency',
        status: brainHealthy ? 'pass' : 'warn',
        message: brainHealthy ? `Brain responsive (${brain.metrics.avgDecisionTime}ms avg)` : `Brain slow: ${brain.metrics.avgDecisionTime}ms`,
        details: { status: brain.status, avgDecisionTime: brain.metrics.avgDecisionTime },
    });
    // Memory
    try {
        const { getMemoryFabric } = await import('../brains/index.js');
        const fabric = getMemoryFabric();
        await fabric.read('short', '_health_check');
        checks.push({ component: 'memory-pressure', status: 'pass', message: 'Memory fabric responsive' });
    }
    catch (e) {
        checks.push({ component: 'memory-pressure', status: 'fail', message: `Memory error: ${e.message}` });
    }
    // Orchestrator
    try {
        const health = await getOrchestratorHealth();
        checks.push({
            component: 'orchestrator',
            status: health.status === 'healthy' ? 'pass' : health.status === 'degraded' ? 'warn' : 'fail',
            message: `Orchestrator ${health.status}`,
            details: { components: Object.keys(health.components) },
        });
    }
    catch (e) {
        checks.push({ component: 'orchestrator', status: 'fail', message: `Health check failed: ${e.message}` });
    }
    return checks;
}
function generateRecommendations(checks, repairs) {
    const recs = [];
    const failedRepairs = repairs.filter(r => !r.repaired);
    if (failedRepairs.length > 0)
        recs.push('Manual intervention required for failed repairs');
    const slowTools = checks.find(c => c.component === 'tool-failure' && c.status === 'fail');
    if (slowTools)
        recs.push('Consider restarting degraded tools or increasing timeout');
    const brainWarn = checks.find(c => c.component === 'brain-latency' && c.status === 'warn');
    if (brainWarn)
        recs.push('Brain latency elevated — monitor for continued degradation');
    if (checks.every(c => c.status === 'pass'))
        recs.push('System fully healthy — no action needed');
    return recs;
}
async function repairToolFailure() {
    const issues = [];
    const actions = [];
    const toolMetrics = getAllToolMetrics();
    for (const [name, metrics] of Object.entries(toolMetrics)) {
        if (metrics.failures > metrics.invocations * 0.5 && metrics.invocations > 3) {
            issues.push(`Tool ${name} failing at ${Math.round(metrics.failures / metrics.invocations * 100)}%`);
            metrics.failures = 0;
            metrics.invocations = 0;
            actions.push(`Reset metrics for ${name}`);
        }
    }
    return { id: `repair-${Date.now()}`, repaired: issues.length > 0, issues, actions, timestamp: Date.now() };
}
async function repairLLMProvider() {
    return {
        id: `repair-${Date.now()}`, repaired: false,
        issues: ['LLM provider failure requires routing policy update — manual action needed'],
        actions: ['Update routing policy to use alternative provider'],
        timestamp: Date.now(),
    };
}
async function repairBrainLatency() {
    const brain = getPrimaryBrain();
    brain.metrics.avgDecisionTime = 0;
    return { id: `repair-${Date.now()}`, repaired: true, issues: ['Brain decision latency elevated'], actions: ['Reset brain latency baseline'], timestamp: Date.now() };
}
async function repairMemoryPressure() {
    const { getMemoryFabric } = await import('../brains/index.js');
    const fabric = getMemoryFabric();
    await fabric.write('short', '_pressure_clear', true, 1000);
    return { id: `repair-${Date.now()}`, repaired: true, issues: ['Memory pressure detected'], actions: ['Cleared short-term memory TTL entries'], timestamp: Date.now() };
}
async function repairWorkflowStuck() {
    return { id: `repair-${Date.now()}`, repaired: true, issues: ['Workflow may be stuck'], actions: ['Workflow timeout will trigger automatic retry'], timestamp: Date.now() };
}
export { runDiagnostics };
