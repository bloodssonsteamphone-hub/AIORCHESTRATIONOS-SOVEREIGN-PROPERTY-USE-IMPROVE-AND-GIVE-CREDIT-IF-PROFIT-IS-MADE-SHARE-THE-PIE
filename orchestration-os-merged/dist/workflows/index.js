export { createWorkflowEngine, WORKFLOW_CATALOG };
const WORKFLOW_CATALOG = {
    'wf-build-fullstack-app': {
        id: 'wf-build-fullstack-app',
        name: 'Build Fullstack App',
        description: 'End-to-end fullstack app from a single prompt',
        version: '1.0.0',
        steps: [
            { id: 's1', name: 'Classify Intent', action: 'llm.classify', status: 'pending', dependencies: [] },
            { id: 's2', name: 'Generate Architecture', action: 'agent.architect', status: 'pending', dependencies: ['s1'] },
            { id: 's3', name: 'Generate DB Schema', action: 'agent.coder', status: 'pending', dependencies: ['s2'] },
            { id: 's4', name: 'Generate API Routes', action: 'agent.coder', status: 'pending', dependencies: ['s2'] },
            { id: 's5', name: 'Generate Frontend', action: 'agent.coder', status: 'pending', dependencies: ['s2'] },
            { id: 's6', name: 'Generate Tests', action: 'agent.tester', status: 'pending', dependencies: ['s3', 's4', 's5'] },
            { id: 's7', name: 'Run Tests', action: 'tool.test-runner', status: 'pending', dependencies: ['s6'] },
            { id: 's8', name: 'Generate Docs', action: 'agent.docs', status: 'pending', dependencies: ['s7'] },
            { id: 's9', name: 'Package Artifact', action: 'tool.zip-bundler', status: 'pending', dependencies: ['s8'] },
        ],
        config: { parallel: true, timeout: 300000, retryPolicy: { maxRetries: 2, backoffMs: 1000, exponentialBackoff: true } },
        createdAt: Date.now(),
    },
    'wf-self-diagnose': {
        id: 'wf-self-diagnose',
        name: 'Self Diagnose & Repair',
        description: 'Health check + automatic repair of the orchestration system',
        version: '1.0.0',
        steps: [
            { id: 's1', name: 'Check LLM Providers', action: 'orchestrator.health', status: 'pending', dependencies: [] },
            { id: 's2', name: 'Check Tool Registry', action: 'tool.metrics', status: 'pending', dependencies: [] },
            { id: 's3', name: 'Check Memory Fabric', action: 'memory.check', status: 'pending', dependencies: [] },
            { id: 's4', name: 'Run Self-Repair', action: 'selfrepair.run', status: 'pending', dependencies: ['s1', 's2', 's3'] },
            { id: 's5', name: 'Report Findings', action: 'agent.orchestrator', status: 'pending', dependencies: ['s4'] },
        ],
        config: { parallel: true, timeout: 60000, retryPolicy: { maxRetries: 1, backoffMs: 500, exponentialBackoff: false } },
        createdAt: Date.now(),
    },
    'wf-release-windows': {
        id: 'wf-release-windows',
        name: 'Release Windows Desktop App',
        description: 'Package and release a Windows executable',
        version: '1.0.0',
        steps: [
            { id: 's1', name: 'Validate Build Output', action: 'tool.file.stat', status: 'pending', dependencies: [] },
            { id: 's2', name: 'Bundle with Electron', action: 'agent.devops', status: 'pending', dependencies: ['s1'] },
            { id: 's3', name: 'Build Windows EXE', action: 'run.command', status: 'pending', dependencies: ['s2'] },
            { id: 's4', name: 'Sign Executable', action: 'run.command', status: 'pending', dependencies: ['s3'] },
            { id: 's5', name: 'Create ZIP', action: 'tool.zip-bundler', status: 'pending', dependencies: ['s4'] },
        ],
        config: { parallel: false, timeout: 600000, retryPolicy: { maxRetries: 1, backoffMs: 2000, exponentialBackoff: true } },
        createdAt: Date.now(),
    },
    'wf-video-understanding': {
        id: 'wf-video-understanding',
        name: 'Multimodal Video Understanding',
        description: 'Extract frames, transcribe audio, analyze with vision AI',
        version: '1.0.0',
        steps: [
            { id: 's1', name: 'Extract Frames', action: 'tool.video.extract_frames', status: 'pending', dependencies: [] },
            { id: 's2', name: 'Transcribe Audio', action: 'tool.audio.transcribe', status: 'pending', dependencies: [] },
            { id: 's3', name: 'Analyze Frames', action: 'llm.vision', status: 'pending', dependencies: ['s1'] },
            { id: 's4', name: 'Generate Summary', action: 'llm.complete', status: 'pending', dependencies: ['s2', 's3'] },
        ],
        config: { parallel: true, timeout: 120000 },
        createdAt: Date.now(),
    },
};
function createWorkflowEngine() {
    const workflows = new Map();
    function getMetrics(wf) {
        return wf.metrics || { totalRuns: 0, successRate: 0, avgDuration: 0, avgStepsCompleted: 0 };
    }
    function cloneWorkflow(id) {
        const template = WORKFLOW_CATALOG[id];
        if (!template)
            return undefined;
        const wf = {
            id: template.id, name: template.name, description: template.description,
            version: template.version, steps: template.steps, config: template.config,
            createdAt: template.createdAt, status: 'idle',
            metrics: { totalRuns: 0, successRate: 0, avgDuration: 0, avgStepsCompleted: 0 },
        };
        workflows.set(id, wf);
        return wf;
    }
    async function run(workflowId, context = {}) {
        let wf = workflows.get(workflowId);
        if (!wf)
            wf = cloneWorkflow(workflowId);
        if (!wf)
            throw new Error(`Unknown workflow: ${workflowId}`);
        for (const step of wf.steps) {
            step.status = 'pending';
            step.result = undefined;
            step.error = undefined;
        }
        wf.status = 'running';
        const startTime = Date.now();
        const ctx = { ...context };
        console.log(`[Workflow] Starting: ${wf.name} (parallel=${wf.config.parallel})`);
        const stepMap = new Map(wf.steps.map(s => [s.id, s]));
        const completed = new Set();
        let allSucceeded = true;
        if (wf.config.parallel) {
            const phases = buildDependencyPhases(wf.steps);
            for (const phase of phases) {
                const results = await Promise.allSettled(phase.map(step => executeStepAsync(step, ctx, stepMap, completed)));
                for (let i = 0; i < phase.length; i++) {
                    const step = phase[i];
                    const result = results[i];
                    if (result.status === 'fulfilled') {
                        completed.add(step.id);
                    }
                    else {
                        step.error = result.reason?.message || 'Unknown error';
                        step.status = 'failed';
                        completed.add(step.id);
                        allSucceeded = false;
                        if (wf.config.rollbackOnFailure)
                            break;
                    }
                }
                if (!allSucceeded && wf.config.rollbackOnFailure)
                    break;
            }
        }
        else {
            for (const step of wf.steps) {
                if (!canRun(step, stepMap, completed)) {
                    step.status = 'skipped';
                    completed.add(step.id);
                    continue;
                }
                try {
                    const result = await executeStepAsync(step, ctx, stepMap, completed);
                    completed.add(step.id);
                }
                catch (e) {
                    step.error = e.message;
                    step.status = 'failed';
                    completed.add(step.id);
                    allSucceeded = false;
                    if (wf.config.rollbackOnFailure)
                        break;
                }
            }
        }
        wf.status = allSucceeded ? 'complete' : 'failed';
        wf.updatedAt = Date.now();
        const duration = Date.now() - startTime;
        const totalRuns = getMetrics(wf).totalRuns + 1;
        wf.metrics = {
            totalRuns,
            successRate: (getMetrics(wf).successRate * (totalRuns - 1) + (allSucceeded ? 1 : 0)) / totalRuns,
            avgDuration: (getMetrics(wf).avgDuration * (totalRuns - 1) + duration) / totalRuns,
            avgStepsCompleted: (getMetrics(wf).avgStepsCompleted * (totalRuns - 1) + completed.size) / totalRuns,
        };
        console.log(`[Workflow] ${wf.name}: ${wf.status} (${duration}ms, ${completed.size}/${wf.steps.length} steps)`);
        return wf;
    }
    function buildDependencyPhases(steps) {
        const phases = [];
        const remaining = new Set(steps.map(s => s.id));
        const completed = new Set();
        while (remaining.size > 0) {
            const phase = [];
            for (const step of steps) {
                if (!remaining.has(step.id))
                    continue;
                if (canRun(step, new Map(steps.map(s => [s.id, s])), completed)) {
                    phase.push(step);
                }
            }
            if (phase.length === 0) {
                phases.push(steps.filter(s => remaining.has(s.id)));
                break;
            }
            phases.push(phase);
            for (const step of phase) {
                remaining.delete(step.id);
                completed.add(step.id);
            }
        }
        return phases;
    }
    function canRun(step, stepMap, completed) {
        if (!step.dependencies?.length)
            return true;
        return step.dependencies.every(dep => completed.has(dep));
    }
    async function executeStepAsync(step, _ctx, stepMap, completed) {
        if (!canRun(step, stepMap, completed)) {
            step.status = 'skipped';
            return { status: 'skipped' };
        }
        step.status = 'running';
        const stepStart = Date.now();
        try {
            const result = await executeStep(step, _ctx);
            step.result = result;
            step.status = 'complete';
            step.duration = Date.now() - stepStart;
            completed.add(step.id);
            console.log(`  [Step] ✅ ${step.name} (${step.duration}ms)`);
            return result;
        }
        catch (e) {
            step.error = e.message;
            step.status = 'failed';
            step.duration = Date.now() - stepStart;
            completed.add(step.id);
            console.log(`  [Step] ❌ ${step.name}: ${e.message}`);
            throw e;
        }
    }
    async function executeStep(step, _ctx) {
        const [domain, action] = step.action.split('.');
        switch (domain) {
            case 'llm': {
                const { createLLMClient } = await import('../llm/index.js');
                const llm = await createLLMClient();
                return llm(step.name, `You are executing step: ${step.name}. ${step.params?.instruction || ''}`);
            }
            case 'agent': {
                return { agent: step.agent || action, status: 'simulated' };
            }
            case 'tool': {
                const { invokeTool } = await import('../tools/index.js');
                return invokeTool(action, step.params || {});
            }
            case 'orchestrator': {
                const { getOrchestratorHealth } = await import('../orchestration/index.js');
                return getOrchestratorHealth();
            }
            case 'selfrepair': {
                const { runSelfRepair } = await import('../selfrepair/index.js');
                return runSelfRepair();
            }
            case 'run': {
                const { runtimes } = await import('../runtime/index.js');
                const cmd = step.params?.command;
                const rt = step.params?.runtime || 'bash';
                const allRuntimes = runtimes;
                const r = allRuntimes[rt] || allRuntimes.bash;
                return r.exec(cmd || `echo "Step: ${step.name}"`, {});
            }
            default:
                return { domain, action, status: 'noop' };
        }
    }
    function get(id) {
        const fromMap = workflows.get(id);
        if (fromMap)
            return fromMap;
        const template = WORKFLOW_CATALOG[id];
        if (!template)
            return undefined;
        return { ...template, status: 'idle', metrics: { totalRuns: 0, successRate: 0, avgDuration: 0, avgStepsCompleted: 0 } };
    }
    function list() { return Array.from(workflows.values()); }
    function register(workflow) { workflows.set(workflow.id, workflow); }
    for (const id of Object.keys(WORKFLOW_CATALOG))
        cloneWorkflow(id);
    return { run, get, list, register };
}
