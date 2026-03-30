// Layer 3 — Orchestrator Tools (orchestrator.*)
// Phase 3: orchestrator.inspect, orchestrator.patch, orchestrator.health
// Global orchestrator reference — set by server.ts on boot
let _orchestratorRef = null;
export function setOrchestratorRef(ref) { _orchestratorRef = ref; }
export const orchestratorTool = {
    name: 'orchestrator',
    category: 'orchestrator',
    description: 'Inspect and patch the orchestrator state, health, routing, and hooks',
    capabilities: ['inspect', 'patch', 'health', 'status', 'reload-blueprint'],
    metrics: { invocations: 0, successes: 0, failures: 0, avgDuration: 0 },
    invoke: async (params) => {
        const start = Date.now();
        const { action, target, value, key } = params;
        const orch = _orchestratorRef;
        if (!orch)
            return { success: false, error: 'Orchestrator not initialized', duration: Date.now() - start };
        try {
            switch (action) {
                case 'inspect': {
                    if (!target)
                        throw new Error('target required for inspect');
                    const val = target.split('.').reduce((o, k) => o?.[k], orch);
                    return { success: true, data: { target, value: val }, duration: Date.now() - start };
                }
                case 'health': {
                    const health = await orch.getHealth();
                    return { success: true, data: health, duration: Date.now() - start };
                }
                case 'status': {
                    const state = {
                        status: orch.status || 'ready',
                        activeSessions: orch.sessions?.size || 0,
                        activeAgents: 0,
                        queueDepth: 0,
                        lastHealthCheck: Date.now(),
                    };
                    return { success: true, data: state, duration: Date.now() - start };
                }
                case 'patch': {
                    if (!key || value === undefined)
                        throw new Error('key and value required for patch');
                    // Patch routing policy
                    if (key === 'routing.tier') {
                        orch.config = orch.config || {};
                        orch.config.routingPolicy = orch.config.routingPolicy || {};
                        orch.config.routingPolicy.global = value;
                    }
                    else if (key === 'routing.strategy') {
                        orch.config = orch.config || {};
                        orch.config.routingPolicy = orch.config.routingPolicy || {};
                        orch.config.routingPolicy.federation = orch.config.routingPolicy.federation || {};
                        orch.config.routingPolicy.federation.strategy = value;
                    }
                    else {
                        // Generic nested patch
                        const keys = key.split('.');
                        let obj = orch;
                        while (keys.length > 1)
                            obj = obj[keys.shift()];
                        obj[keys[0]] = value;
                    }
                    return { success: true, data: { key, value, message: 'Patched' }, duration: Date.now() - start };
                }
                case 'reload-blueprint': {
                    if (typeof orch.reloadBlueprint === 'function') {
                        await orch.reloadBlueprint();
                        return { success: true, data: { message: 'Blueprint reloaded' }, duration: Date.now() - start };
                    }
                    return { success: false, error: 'reloadBlueprint not available', duration: Date.now() - start };
                }
                default:
                    throw new Error(`Unknown orchestrator action: ${action}`);
            }
        }
        catch (e) {
            return { success: false, error: e.message, duration: Date.now() - start };
        }
    },
};
