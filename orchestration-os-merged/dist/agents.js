// Smart Agents — Planner + Generator with Self-Repair
import { llm } from './llm.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
const PLANNER_SYSTEM = `You are an expert software architect. Output ONLY valid JSON:
{"plan": "brief approach", "files": [{"path": "file.ext", "description": "what it does", "language": "python"}]}
No markdown, no explanations.`;
const GENERATOR_SYSTEM = `You are an expert coder. Output ONLY valid JSON:
{"path": "file.ext", "content": "COMPLETE code", "note": "optional note"}
No markdown, no explanations, no truncation.`;
export async function planner(session) {
    const prompt = `Request: ${session.idea}\n\nOutput ONLY valid JSON.`;
    const response = await llm.generate(prompt, PLANNER_SYSTEM, { routing: 'local-free', maxTokens: 2048 });
    if (!response.success || !response.content) {
        throw new Error(`Planning failed: ${response.error}`);
    }
    const parsed = llm.parseJSONResponse(response.content);
    if (!parsed || typeof parsed !== 'object') {
        return { plan: String(parsed || 'Generate files'), files: [] };
    }
    const obj = parsed;
    return {
        plan: obj.plan || 'Build application',
        files: Array.isArray(obj.files) ? obj.files : []
    };
}
export async function generator(session, fileSpec) {
    const prompt = `Create file: ${fileSpec.path}
For: ${session.idea}
Description: ${fileSpec.description || 'Implement functionality'}

Output ONLY valid JSON.`;
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const response = await llm.generate(prompt, GENERATOR_SYSTEM, {
            routing: 'local-free',
            temperature: 0.2,
            maxTokens: 8192
        });
        if (!response.success || !response.content)
            continue;
        const parsed = llm.parseJSONResponse(response.content);
        if (parsed && typeof parsed === 'object' && parsed.path && parsed.content) {
            const obj = parsed;
            return {
                path: obj.path,
                content: obj.content
            };
        }
    }
    throw new Error(`Generator failed after ${maxRetries} attempts`);
}
export function writeFiles(files, basePath) {
    let written = 0;
    for (const file of files) {
        try {
            const fullPath = join(basePath, file.path);
            if (!existsSync(dirname(fullPath))) {
                mkdirSync(dirname(fullPath), { recursive: true });
            }
            writeFileSync(fullPath, file.content, 'utf-8');
            written++;
            console.log(`[File] ✓ ${file.path} (${file.content.length} chars)`);
        }
        catch (e) {
            console.log(`[File] ✗ Failed ${file.path}: ${e}`);
        }
    }
    return written;
}
