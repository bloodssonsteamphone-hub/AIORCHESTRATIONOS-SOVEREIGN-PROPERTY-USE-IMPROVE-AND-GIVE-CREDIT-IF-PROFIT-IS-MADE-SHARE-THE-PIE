// LLM Client — Multi-Provider with Federation
// Tier 1: local-free → Tier 2: cloud-free → Tier 3: paid-explicit-only

export interface LLMResult {
  text: string;
  provider: string;
  model: string;
  duration: number;
  tokens?: number;
}

interface Provider {
  name: string;
  tier: 'local-free' | 'cloud-free' | 'paid-explicit-only';
  defaultModel: string;
  baseUrl: string;
  apiKey?: string;
}

const PROVIDERS: Record<string, Provider> = {
  ollama: {
    name: 'ollama',
    tier: 'local-free',
    defaultModel: 'qwen2.5:0.5b',
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  },
  groq: {
    name: 'groq',
    tier: 'cloud-free',
    defaultModel: 'llama-3.3-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY,
  },
  openrouter: {
    name: 'openrouter',
    tier: 'cloud-free',
    defaultModel: 'google/gemini-2.0-flash-thinking-exp',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
  },
};

export function getProviderInfo() {
  return Object.values(PROVIDERS).map(p => ({
    name: p.name,
    tier: p.tier,
    model: p.defaultModel,
    configured: p.apiKey ? '✅' : '⚠️',
  }));
}

export async function callOllama(prompt: string, model: string): Promise<LLMResult> {
  const start = Date.now();
  const res = await fetch(`${PROVIDERS.ollama.baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false, options: { num_predict: 2048 } }),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = await res.json() as any;
  return {
    text: data.response || '',
    provider: 'ollama',
    model,
    duration: Date.now() - start,
  };
}

export async function callGroq(prompt: string, model: string): Promise<LLMResult> {
  const start = Date.now();
  const res = await fetch(`${PROVIDERS.groq.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PROVIDERS.groq.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });
  if (!res.ok) throw new Error(`Groq error: ${res.status}`);
  const data = await res.json() as any;
  return {
    text: data.choices?.[0]?.message?.content || '',
    provider: 'groq',
    model,
    duration: Date.now() - start,
    tokens: data.usage?.total_tokens,
  };
}

export async function callOpenRouter(prompt: string, model: string): Promise<LLMResult> {
  const start = Date.now();
  const res = await fetch(`${PROVIDERS.openrouter.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PROVIDERS.openrouter.apiKey}`,
      'HTTP-Referer': 'https://zo.computer',
      'X-Title': 'Zo Orchestration OS',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter error: ${res.status}`);
  const data = await res.json() as any;
  return {
    text: data.choices?.[0]?.message?.content || '',
    provider: 'openrouter',
    model,
    duration: Date.now() - start,
    tokens: data.usage?.total_tokens,
  };
}

export async function createLLMClient() {
  async function llm(prompt: string, system?: string): Promise<string> {
    const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;
    
    // Try Groq first (fastest free tier)
    if (PROVIDERS.groq.apiKey) {
      try {
        const result = await callGroq(fullPrompt, PROVIDERS.groq.defaultModel);
        console.log(`✅ LLM: ${result.provider}/${result.model} (${result.duration}ms)`);
        return result.text;
      } catch (e: any) {
        console.log(`⚠️ Groq failed: ${e.message}`);
      }
    }
    
    // Try OpenRouter
    if (PROVIDERS.openrouter.apiKey) {
      try {
        const result = await callOpenRouter(fullPrompt, PROVIDERS.openrouter.defaultModel);
        console.log(`✅ LLM: ${result.provider}/${result.model} (${result.duration}ms)`);
        return result.text;
      } catch (e: any) {
        console.log(`⚠️ OpenRouter failed: ${e.message}`);
      }
    }
    
    // Try Ollama
    try {
      const result = await callOllama(fullPrompt, PROVIDERS.ollama.defaultModel);
      console.log(`✅ LLM: ${result.provider}/${result.model} (${result.duration}ms)`);
      return result.text;
    } catch (e: any) {
      console.log(`⚠️ Ollama failed: ${e.message}`);
    }
    
    throw new Error('No LLM providers available');
  }
  
  return llm;
}
