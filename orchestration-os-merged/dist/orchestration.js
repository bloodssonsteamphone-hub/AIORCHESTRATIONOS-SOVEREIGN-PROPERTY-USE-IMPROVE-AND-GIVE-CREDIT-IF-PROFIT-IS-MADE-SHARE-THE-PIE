// Orchestration Brain
import { planner, generator, writeFiles } from './agents.js';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
const sessions = new Map();
export function createSession(idea) {
    const id = crypto.randomUUID();
    const session = {
        id,
        idea,
        files: [],
        status: 'pending',
        retries: 0,
        createdAt: Date.now()
    };
    sessions.set(id, session);
    return session;
}
export function getSession(id) {
    return sessions.get(id);
}
export async function runBuild(sessionId) {
    const session = sessions.get(sessionId);
    if (!session)
        throw new Error('Session not found');
    const startTime = Date.now();
    session.status = 'running';
    try {
        console.log('[Orchestrator] Planning...');
        const { plan, files: fileSpecs } = await planner(session);
        console.log(`[Orchestrator] ✓ Plan: ${plan} (${fileSpecs.length} files)`);
        const generatedFiles = [];
        for (const spec of fileSpecs) {
            try {
                console.log(`[Generator] Creating ${spec.path}...`);
                const file = await generator(session, spec);
                generatedFiles.push(file);
            }
            catch (e) {
                console.log(`[Generator] ✗ ${spec.path}: ${e}`);
            }
        }
        const outputDir = join(process.cwd(), 'output', `project-${session.id.slice(0, 8)}`);
        if (!existsSync(outputDir))
            mkdirSync(outputDir, { recursive: true });
        const written = writeFiles(generatedFiles, outputDir);
        session.files = generatedFiles;
        session.status = written > 0 ? 'success' : 'failure';
        session.duration = Date.now() - startTime;
        console.log(`[Orchestrator] ✓ ${written}/${generatedFiles.length} files in ${session.duration}ms`);
    }
    catch (e) {
        session.status = 'failure';
        session.error = String(e);
        session.duration = Date.now() - startTime;
        console.log(`[Orchestrator] ✗ Failed: ${e}`);
    }
    return session;
}
export function getSystemStatus() {
    return {
        sessions: sessions.size,
        uptime: process.uptime(),
        memory: process.memoryUsage().heapUsed,
        timestamp: Date.now()
    };
}
