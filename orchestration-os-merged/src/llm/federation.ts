// L8 — Multi-Provider LLM Federation with Consensus & Champion-Challenger
import type { LLMResult } from './index.js';
import { callOllama, callGroq, callOpenRouter } from './index.js';

export interface RoutingPolicy {
  global: 'local-free' | 'cloud-free' | 'paid-explicit-only';
  federation: {
    enabled: boolean;
    strategy: 'sequential' | 'consensus' | 'champion-challenger';
    maxParallel: number;
  };
  perAgent?: Record<string, 'local-free' | 'cloud-free' | 'paid-explicit-only'>;
}

let routingPolicy: RoutingPolicy = {
  global: 'cloud-free',
  federation: { enabled: true, strategy: 'consensus', maxParallel: 3 },
};

export function getRoutingPolicy(): RoutingPolicy { return { ...routingPolicy }; }
export function setRoutingPolicy(patch: Partial<RoutingPolicy>) { routingPolicy = { ...routingPolicy, ...patch }; }

// Tier → provider IDs
const PROVIDERS_BY_TIER: Record<string, string[]> = {
  'local-free': ['ollama'],
  'cloud-free': ['groq', 'openrouter'],
  'paid-explicit-only': ['chatgpt', 'gemini', 'claude'],
};

const DEFAULT_MODELS: Record<string, string> = {
  'ollama': 'qwen2.5:0.5b',
  'groq': 'llama-3.3-70b-versatile',
  'openrouter': 'google/gemini-2.0-flash-thinking-exp',
  'chatgpt': 'gpt-4.1',
  'gemini': 'gemini-2.0-flash',
  'claude': 'claude-3.7-sonnet',
};

const callProvider: Record<string, (prompt: string, model: string) => Promise<LLMResult>> = {
  ollama: callOllama,
  groq: callGroq,
  openrouter: callOpenRouter,
};

const championState: Record<string, { champion: string; wins: number; losses: number; streak: number }> = {};
const consensusVotes: Record<string, Record<string, number>> = {};

function tierProviders(tier: string): string[] {
  return PROVIDERS_BY_TIER[tier] || PROVIDERS_BY_TIER['cloud-free'];
}

// Normalize provider response to a comparable string
function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').toLowerCase().trim();
}

// Jaccard similarity between two response strings
function similarity(a: string, b: string): number {
  const wordsA = new Set(normalize(a).split(' '));
  const wordsB = new Set(normalize(b).split(' '));
  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

// Federated client factory
export async function createFederatedClient() {
  const { callOllama: cOllama, callGroq: cGroq, callOpenRouter: cOpenRouter } = await import('./index.js');

  async function llm(prompt: string, opts?: { system?: string; model?: string; tier?: string }): Promise<string> {
    const tier = opts?.tier || routingPolicy.global;
    const result = await federatedLLM(prompt, tier as any);
    return result.text;
  }

  async function federation(opts: {
    prompt: string;
    systemPrompt?: string;
    strategy?: 'consensus' | 'champion-challenger' | 'specialist-routing' | 'sequential';
    tiers?: string[];
    agents?: string[];
    maxParallel?: number;
  }): Promise<{
    results: LLMResult[];
    bestResult: LLMResult;
    consensus?: string;
    evaluation?: Record<string, unknown>;
  }> {
    const tier = opts.tiers?.[0] || routingPolicy.global;
    const results: LLMResult[] = [];
    const settled = await Promise.allSettled([
      cOllama(opts.prompt, 'qwen2.5:0.5b'),
      cGroq(opts.prompt, 'llama-3.3-70b-versatile'),
      cOpenRouter(opts.prompt, 'google/gemini-2.0-flash-thinking-exp'),
    ]);
    for (const r of settled) {
      if (r.status === 'fulfilled') results.push(r.value);
    }
    if (results.length === 0) throw new Error('All federation providers failed');
    const bestResult = results[0];
    return { results, bestResult, consensus: bestResult.text.slice(0, 100), evaluation: {} };
  }

  return { llm, federation };
}

// Consensus: fan-out to all providers in tier, vote on best
async function consensusCall(prompt: string, tier: string): Promise<LLMResult> {
  const providers = tierProviders(tier);
  const results: LLMResult[] = [];

  const calls = providers.map(async (provider) => {
    try {
      const fn = callProvider[provider];
      if (!fn) return null;
      const result = await fn(prompt, DEFAULT_MODELS[provider] || 'default');
      return result;
    } catch { return null; }
  });

  const settled = await Promise.allSettled(calls);
  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value) results.push(r.value);
  }

  if (results.length === 0) throw new Error('All federation providers failed');
  if (results.length === 1) return results[0];

  // Pairwise voting: each pair contributes a vote
  const votes: Record<string, number> = {};
  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      const sim = similarity(results[i].text, results[j].text);
      if (sim > 0.7) {
        votes[results[i].provider] = (votes[results[i].provider] || 0) + sim;
        votes[results[j].provider] = (votes[results[j].provider] || 0) + sim;
      } else {
        // Dissimilar — shorter response gets slight preference (typically more precise)
        const winner = results[i].text.length <= results[j].text.length ? i : j;
        votes[results[winner].provider] = (votes[results[winner].provider] || 0) + 1;
      }
    }
  }

  let bestProvider = results[0].provider;
  let bestVotes = -1;
  for (const [p, v] of Object.entries(votes)) {
    if (v > bestVotes) { bestVotes = v; bestProvider = p; }
  }

  const best = results.find(r => r.provider === bestProvider) || results[0];
  console.log(`[Federation:consensus] Providers: ${results.map(r => r.provider).join(',')} | Winner: ${bestProvider} (${bestVotes.toFixed(2)} votes)`);
  return best;
}

// Champion-challenger: track win/loss, promote champion
async function championChallengerCall(prompt: string, tier: string): Promise<LLMResult> {
  const providers = tierProviders(tier);
  if (providers.length < 2) return consensusCall(prompt, tier);

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

  if (!championResult) return challengerResult || consensusCall(prompt, tier);
  if (!challengerResult) return championResult;

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
  } else {
    state.losses++;
    state.streak = 0;
    console.log(`[Federation:cc] Champion holds (${championScore} >= ${challengerScore})`);
    return championResult;
  }
}

// Sequential: try in order until one succeeds
async function sequentialCall(prompt: string, tier: string): Promise<LLMResult> {
  const providers = tierProviders(tier);
  for (const provider of providers) {
    try {
      const fn = callProvider[provider];
      if (!fn) continue;
      const result = await fn(prompt, DEFAULT_MODELS[provider] || 'default');
      console.log(`[Federation:sequential] ${provider} succeeded (${result.duration}ms)`);
      return result;
    } catch (e: any) {
      console.log(`[Federation:sequential] ${provider} failed: ${e.message}`);
    }
  }
  throw new Error('All providers exhausted');
}

// Top-level federated call
export async function federatedLLM(prompt: string, tier?: string): Promise<LLMResult> {
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
