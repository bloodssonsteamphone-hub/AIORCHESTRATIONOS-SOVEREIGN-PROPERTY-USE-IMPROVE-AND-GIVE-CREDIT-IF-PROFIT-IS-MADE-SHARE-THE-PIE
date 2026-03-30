import { callOllama, callGroq, callOpenRouter } from './index.js';
let routingPolicy = {
    global: 'cloud-free',
    federation: { enabled: true, strategy: 'consensus', maxParallel: 3 },
};
export function getRoutingPolicy() { return { ...routingPolicy }; }
export function setRoutingPolicy(patch) { routingPolicy = { ...routingPolicy, ...patch }; }
// Tier → provider IDs
const PROVIDERS_BY_TIER = {
    'local-free': ['ollama'],
    'cloud-free': ['groq', 'openrouter'],
    'paid-explicit-only': ['chatgpt', 'gemini', 'claude'],
};
const DEFAULT_MODELS = {
    'ollama': 'qwen2.5:0.5b',
    'groq': 'llama-3.3-70b-versatile',
    'openrouter': 'google/gemini-2.0-flash-thinking-exp',
    'chatgpt': 'gpt-4.1',
    'gemini': 'gemini-2.0-flash',
    'claude': 'claude-3.7-sonnet',
};
const callProvider = {
    ollama: callOllama,
    groq: callGroq,
    openrouter: callOpenRouter,
};
const championState = {};
const consensusVotes = {};
function tierProviders(tier) {
    return PROVIDERS_BY_TIER[tier] || PROVIDERS_BY_TIER['cloud-free'];
}
// Normalize provider response to a comparable string
function normalize(text) {
    return text.replace(/\s+/g, ' ').toLowerCase().trim();
}
// Jaccard similarity between two response strings
function similarity(a, b) {
    const wordsA = new Set(normalize(a).split(' '));
    const wordsB = new Set(normalize(b).split(' '));
    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
}
// Federated client factory
export async function createFederatedClient() {
    const { callOllama: cOllama, callGroq: cGroq, callOpenRouter: cOpenRouter } = await import('./index.js');
    async function llm(prompt, opts) {
        const tier = opts?.tier || routingPolicy.global;
        const result = await federatedLLM(prompt, tier);
        return result.text;
    }
    async function federation(opts) {
        const tier = opts.tiers?.[0] || routingPolicy.global;
        const results = [];
        const settled = await Promise.allSettled([
            cOllama(opts.prompt, 'qwen2.5:0.5b'),
            cGroq(opts.prompt, 'llama-3.3-70b-versatile'),
            cOpenRouter(opts.prompt, 'google/gemini-2.0-flash-thinking-exp'),
        ]);
        for (const r of settled) {
            if (r.status === 'fulfilled')
                results.push(r.value);
        }
        if (results.length === 0)
            throw new Error('All federation providers failed');
        const bestResult = results[0];
        return { results, bestResult, consensus: bestResult.text.slice(0, 100), evaluation: {} };
    }
    return { llm, federation };
}
// Consensus: fan-out to all providers in tier, vote on best
async function consensusCall(prompt, tier) {
    const providers = tierProviders(tier);
    const results = [];
    const calls = providers.map(async (provider) => {
        try {
            const fn = callProvider[provider];
            if (!fn)
                return null;
            const result = await fn(prompt, DEFAULT_MODELS[provider] || 'default');
            return result;
        }
        catch {
            return null;
        }
    });
    const settled = await Promise.allSettled(calls);
    for (const r of settled) {
        if (r.status === 'fulfilled' && r.value)
            results.push(r.value);
    }
    if (results.length === 0)
        throw new Error('All federation providers failed');
    if (results.length === 1)
        return results[0];
    // Pairwise voting: each pair contributes a vote
    const votes = {};
    for (let i = 0; i < results.length; i++) {
        for (let j = i + 1; j < results.length; j++) {
            const sim = similarity(results[i].text, results[j].text);
            if (sim > 0.7) {
                votes[results[i].provider] = (votes[results[i].provider] || 0) + sim;
                votes[results[j].provider] = (votes[results[j].provider] || 0) + sim;
            }
            else {
                // Dissimilar — shorter response gets slight preference (typically more precise)
                const winner = results[i].text.length <= results[j].text.length ? i : j;
                votes[results[winner].provider] = (votes[results[winner].provider] || 0) + 1;
            }
        }
    }
    let bestProvider = results[0].provider;
    let bestVotes = -1;
    for (const [p, v] of Object.entries(votes)) {
        if (v > bestVotes) {
            bestVotes = v;
            bestProvider = p;
        }
    }
    const best = results.find(r => r.provider === bestProvider) || results[0];
    console.log(`[Federation:consensus] Providers: ${results.map(r => r.provider).join(',')} | Winner: ${bestProvider} (${bestVotes.toFixed(2)} votes)`);
    return best;
}
// Champion-challenger: track win/loss, promote champion
async function championChallengerCall(prompt, tier) {
    const providers = tierProviders(tier);
    if (providers.length < 2)
        return consensusCall(prompt, tier);
    const sessionKey = `cc_${tier}`;
    if (!championState[sessionKey]) {
        championState[sessionKey] = { champion: providers[0], wins: 0, losses: 0, streak: 0 };
    }
    const state = championState[sessionKey];
    // First call: establish champion
    const champion = state.champion;
    const challenger = providers.find(p => p !== champion) || providers[1];
    const championResult = await (callProvider[champion] || callProvider[providers[0]])(prompt, DEFAULT_MODELS[champion] || 'default').catch(() => null);
    const challengerResult = await (callProvider[challenger] || callProvider[providers[0]])(prompt, DEFAULT_MODELS[challenger] || 'default').catch(() => null);
    if (!championResult)
        return challengerResult || consensusCall(prompt, tier);
    if (!challengerResult)
        return championResult;
    // Winner: longer + more structured response typically better for code tasks
    const championScore = championResult.text.length + (championResult.text.includes('```') ? 200 : 0);
    const challengerScore = challengerResult.text.length + (challengerResult.text.includes('```') ? 200 : 0);
    if (challengerScore > championScore) {
        state.wins++;
        state.streak++;
        if (state.streak >= 3) {
            const old = state.champion;
            state.champion = challenger;
            state.streak = 0;
            console.log(`[Federation:cc] Champion promoted: ${challenger} overtook ${old} (${state.wins}W/${state.losses}L)`);
        }
        console.log(`[Federation:cc] Challenger wins this round (${challengerScore} > ${championScore})`);
        return challengerResult;
    }
    else {
        state.losses++;
        state.streak = 0;
        console.log(`[Federation:cc] Champion holds (${championScore} >= ${challengerScore})`);
        return championResult;
    }
}
// Sequential: try in order until one succeeds
async function sequentialCall(prompt, tier) {
    const providers = tierProviders(tier);
    for (const provider of providers) {
        try {
            const fn = callProvider[provider];
            if (!fn)
                continue;
            const result = await fn(prompt, DEFAULT_MODELS[provider] || 'default');
            console.log(`[Federation:sequential] ${provider} succeeded (${result.duration}ms)`);
            return result;
        }
        catch (e) {
            console.log(`[Federation:sequential] ${provider} failed: ${e.message}`);
        }
    }
    throw new Error('All providers exhausted');
}
// Top-level federated call
export async function federatedLLM(prompt, tier) {
    const effectiveTier = tier || routingPolicy.global;
    if (!routingPolicy.federation?.enabled) {
        return sequentialCall(prompt, effectiveTier);
    }
    switch (routingPolicy.federation.strategy) {
        case 'consensus': return consensusCall(prompt, effectiveTier);
        case 'champion-challenger': return championChallengerCall(prompt, effectiveTier);
        default: return sequentialCall(prompt, effectiveTier);
    }
}
export function getFederationStats() {
    return {
        championState: { ...championState },
        consensusVotes: { ...consensusVotes },
        policy: routingPolicy,
    };
}
