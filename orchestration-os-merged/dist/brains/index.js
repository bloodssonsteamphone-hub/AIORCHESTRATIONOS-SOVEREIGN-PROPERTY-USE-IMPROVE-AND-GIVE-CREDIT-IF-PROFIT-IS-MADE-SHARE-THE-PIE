import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
export { createBrainSystem, getPrimaryBrain, getBackupBrain, createMemoryFabric, makeDecision, getMemoryFabric, failover, failoverPolicy };
// ─── In-Memory Store ──────────────────────────────────────────────────────────
const store = new Map();
function cleanExpired() {
    const now = Date.now();
    for (const [k, v] of store) {
        if (v.expiry && v.expiry < now)
            store.delete(k);
    }
}
// ─── Memory Layers ─────────────────────────────────────────────────────────────
function makeMemoryLayer(id, name, _backend, ttl = 0) {
    return {
        id, name,
        description: `Memory layer: ${name}`,
        backend: _backend,
        ttl,
        read: async (key) => {
            cleanExpired();
            const entry = store.get(`${id}:${key}`);
            if (!entry)
                return undefined;
            if (entry.expiry && entry.expiry < Date.now()) {
                store.delete(`${id}:${key}`);
                return undefined;
            }
            return entry.value;
        },
        write: async (key, value, layerTtl) => {
            const expiry = layerTtl || ttl ? Date.now() + (layerTtl || ttl || 86400000) : undefined;
            store.set(`${id}:${key}`, { value, expiry });
        },
        delete: async (key) => { store.delete(`${id}:${key}`); },
        list: async (pattern) => {
            cleanExpired();
            const prefix = `${id}:`;
            const all = Array.from(store.keys()).filter(k => k.startsWith(prefix));
            if (!pattern)
                return all.map(k => k.replace(prefix, ''));
            const regex = new RegExp(pattern.replace('*', '.*'));
            return all.map(k => k.replace(prefix, '')).filter(k => regex.test(k));
        },
    };
}
// ─── Memory Fabric ─────────────────────────────────────────────────────────────
function createMemoryFabric() {
    const shortTerm = makeMemoryLayer('st', 'Short-Term', 'in-memory', 3600000);
    const midTerm = makeMemoryLayer('mt', 'Mid-Term', 'postgresql+vector', 86400000 * 7);
    const longTerm = makeMemoryLayer('lt', 'Long-Term', 'postgresql+s3', 0);
    const persistPath = '/tmp/zo-brain-longterm.jsonl';
    mkdirSync('/tmp', { recursive: true });
    const originalWrite = longTerm.write;
    longTerm.write = async (key, value, ttl) => {
        await originalWrite(key, value, ttl);
        writeFileSync(persistPath, JSON.stringify({ key, value, ts: Date.now() }) + '\n', { flag: 'a' });
    };
    return {
        shortTerm, midTerm, longTerm,
        async read(layer, key) {
            if (layer === 'short')
                return shortTerm.read(key);
            if (layer === 'mid')
                return midTerm.read(key);
            if (layer === 'long')
                return longTerm.read(key);
            throw new Error(`Unknown layer: ${layer}`);
        },
        async write(layer, key, value, ttl) {
            if (layer === 'short')
                return shortTerm.write(key, value, ttl);
            if (layer === 'mid')
                return midTerm.write(key, value, ttl);
            if (layer === 'long')
                return longTerm.write(key, value, ttl);
            throw new Error(`Unknown layer: ${layer}`);
        },
        async checkpoint(workflowId) {
            writeFileSync(`/tmp/zo-checkpoint-${workflowId}.json`, JSON.stringify({ workflowId, store: Object.fromEntries(store), ts: Date.now() }));
        },
        async resume(workflowId) {
            const path = `/tmp/zo-checkpoint-${workflowId}.json`;
            if (!existsSync(path))
                return null;
            const data = JSON.parse(readFileSync(path, 'utf-8'));
            for (const [k, v] of Object.entries(data.store)) {
                store.set(k, v);
            }
            return data;
        },
    };
}
// ─── Brain System ──────────────────────────────────────────────────────────────
let primaryBrain;
let backupBrain;
let memoryFabric;
let isFailover = false;
const failoverPolicy = {
    triggers: ['healthcheck-fail', 'latency-spike', 'panic-error'],
    actions: ['promote-backup', 'spawn-new-backup', 'alert-operator'],
    autoPromote: true,
};
function makeBrainMetrics() {
    return { decisionsMade: 0, decisionsCorrect: 0, avgDecisionTime: 0, failoverCount: 0 };
}
function createBrainSystem() {
    primaryBrain = {
        id: 'zo-brain-primary',
        type: 'primary',
        status: 'active',
        roles: ['global-task-routing', 'llm-routing', 'agent-coordination', 'memory-orchestration', 'self-repair', 'blueprint-evolution'],
        metrics: makeBrainMetrics(),
    };
    backupBrain = {
        id: 'zo-brain-backup',
        type: 'backup',
        status: 'standby',
        syncMode: 'event-log',
        primaryId: primaryBrain.id,
        roles: ['shadow-eval', 'hot-standby', 'failover'],
        metrics: makeBrainMetrics(),
    };
    memoryFabric = createMemoryFabric();
    console.log(`[Brain] Primary: ${primaryBrain.id} (active)`);
    console.log(`[Brain] Backup: ${backupBrain.id} (standby)`);
}
function getPrimaryBrain() { return primaryBrain; }
function getBackupBrain() { return backupBrain; }
function getMemoryFabric() { return memoryFabric; }
async function failover() {
    if (isFailover)
        return;
    isFailover = true;
    backupBrain.status = 'active';
    primaryBrain.status = 'error';
    console.log('[Brain] FAILOVER: Backup promoted to Primary');
}
// ─── Decision Making ──────────────────────────────────────────────────────────
async function makeDecision(context) {
    const start = Date.now();
    const task = context.task.toLowerCase();
    let tier = 'cloud-free';
    if (task.includes('simple') || task.includes('list') || task.includes('read'))
        tier = 'local-free';
    const agents = ['coder'];
    if (task.includes('architect') || task.includes('design'))
        agents.unshift('architect');
    if (task.includes('test'))
        agents.push('tester');
    if (task.includes('docs') || task.includes('document'))
        agents.push('docs');
    const tools = ['file', 'http'];
    if (task.includes('test'))
        tools.push('test-runner');
    if (task.includes('package') || task.includes('zip'))
        tools.push('zip-bundler');
    tools.push('metrics');
    primaryBrain.metrics.decisionsMade++;
    primaryBrain.metrics.avgDecisionTime =
        (primaryBrain.metrics.avgDecisionTime * (primaryBrain.metrics.decisionsMade - 1) + (Date.now() - start))
            / primaryBrain.metrics.decisionsMade;
    primaryBrain.metrics.lastDecision = Date.now();
    return { routing: tier, agents, tools };
}
