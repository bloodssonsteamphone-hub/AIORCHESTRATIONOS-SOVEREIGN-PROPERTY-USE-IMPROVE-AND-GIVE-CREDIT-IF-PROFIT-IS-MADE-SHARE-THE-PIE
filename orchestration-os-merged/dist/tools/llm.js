// Layer 3 — LLM Direct Tools (llm.*)
// Phase 3: llm.complete, llm.chat, llm.plan, llm.vision, llm.embed
// Provides direct access to LLM federation for agents/tools that need it
import { createFederatedClient } from '../llm/federation.js';
const fedClientPromise = createFederatedClient();
let fedClient = null;
fedClientPromise.then(c => { fedClient = c; }).catch(() => { });
export const llmTool = {
    name: 'llm',
    category: 'llm',
    description: 'Direct LLM calls: complete, chat, plan, vision, embed via federated providers',
    capabilities: ['complete', 'chat', 'plan', 'vision', 'embed'],
    metrics: { invocations: 0, successes: 0, failures: 0, avgDuration: 0 },
    invoke: async (params) => {
        const start = Date.now();
        const { action, prompt, messages, system, model, tier, imageUrl } = params;
        const client = fedClient;
        try {
            switch (action) {
                case 'complete': {
                    if (!prompt)
                        throw new Error('prompt required for llm.complete');
                    if (!client)
                        throw new Error('Federated client not initialized yet');
                    const result = await client.llm(prompt, { system, tier });
                    return { success: true, data: result, duration: Date.now() - start };
                }
                case 'chat': {
                    if (!messages?.length)
                        throw new Error('messages required for llm.chat');
                    // Convert chat messages to a single prompt (simple approach)
                    if (!client)
                        throw new Error('Federated client not initialized yet');
                    const fullPrompt = messages.map((m) => `${m.role}: ${m.content}`).join('\n');
                    const result = await client.llm(fullPrompt, { system, tier });
                    return { success: true, data: result, duration: Date.now() - start };
                }
                case 'plan': {
                    if (!client)
                        throw new Error('Federated client not initialized yet');
                    const planningPrompt = prompt || 'Create a plan for this task';
                    const result = await client.llm(`You are a planner. Create a structured, numbered plan for: ${planningPrompt}\n\nRespond with valid JSON only: {"steps": ["step 1", ...], "estimatedTime": "X minutes", "risks": ["risk 1", ...]}`, { system: 'You are a careful planner. Always respond valid JSON.', model, tier });
                    return { success: true, data: result, duration: Date.now() - start };
                }
                case 'vision': {
                    if (!imageUrl)
                        throw new Error('imageUrl required for llm.vision');
                    if (!client)
                        throw new Error('Federated client not initialized yet');
                    const result = await client.llm(`Describe this image in detail: ${imageUrl}`, { model: 'qwen2-vl', tier: 'local-free' });
                    return { success: true, data: result, duration: Date.now() - start };
                }
                case 'embed': {
                    const textToEmbed = prompt || '';
                    if (!client)
                        throw new Error('Federated client not initialized yet');
                    const result = await client.llm(`Generate a dense vector embedding for: ${textToEmbed}\n\nRespond with a JSON array of floats.`, { model: 'nomic-embed-text', tier: 'local-free' });
                    return { success: true, data: result, duration: Date.now() - start };
                }
                default:
                    throw new Error(`Unknown llm action: ${action}`);
            }
        }
        catch (e) {
            return { success: false, error: e.message, duration: Date.now() - start };
        }
    },
};
// Tool that exposes LLM federation as a tool
export const llmFederationTool = {
    name: 'llm-federation',
    category: 'llm',
    description: 'Fan-out LLM calls across multiple providers with consensus/champion/specialist strategies',
    capabilities: ['federated-complete', 'federated-chat', 'evaluate', 'select-best'],
    metrics: { invocations: 0, successes: 0, failures: 0, avgDuration: 0 },
    invoke: async (params) => {
        const start = Date.now();
        const { prompt, system, strategy, tiers, agents, maxParallel } = params;
        try {
            let client = fedClient;
            if (!client) {
                client = await fedClientPromise;
            }
            const result = await client.federation({
                prompt,
                systemPrompt: system,
                strategy: strategy || 'consensus',
                tiers: tiers || ['cloud-free'],
                agents,
                maxParallel: maxParallel || 4,
            });
            return {
                success: true,
                data: {
                    results: result.results.map(r => ({ provider: r.provider, model: r.model, text: r.text.slice(0, 200) + '...', duration: r.duration })),
                    bestResult: { provider: result.bestResult.provider, model: result.bestResult.model, text: result.bestResult.text.slice(0, 200) + '...' },
                    consensus: result.consensus?.slice(0, 200) + '...',
                    evaluation: result.evaluation,
                },
                duration: Date.now() - start,
            };
        }
        catch (e) {
            return { success: false, error: e.message, duration: Date.now() - start };
        }
    },
};
