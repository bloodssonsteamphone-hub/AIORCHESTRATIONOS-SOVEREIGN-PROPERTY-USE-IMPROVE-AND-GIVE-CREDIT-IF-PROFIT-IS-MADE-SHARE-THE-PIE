const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GROQ_KEY = process.env.GROQ_API_KEY || '';
export class LLMClient {
    async generate(prompt, system = 'You are a helpful assistant.', config = {}) {
        const { routing = 'local-free', model, temperature = 0.3, maxTokens = 2048 } = config;
        const providers = this.getProviders(routing, model);
        for (const provider of providers) {
            try {
                console.log(`[LLM] Trying ${provider.name} (${provider.model})...`);
                const response = await this.callProvider(provider, prompt, system, { temperature, maxTokens });
                if (response.success && response.content) {
                    console.log(`[LLM] ✓ ${provider.name} succeeded (${response.duration}ms)`);
                    return response;
                }
                if (response.error) {
                    console.log(`[LLM] ✗ ${provider.name}: ${response.error}`);
                }
            }
            catch (e) {
                console.log(`[LLM] ✗ ${provider.name} exception: ${e}`);
            }
        }
        return { success: false, error: 'All providers failed', content: null, duration: 0 };
    }
    getProviders(routing, preferredModel) {
        const tier = routing.includes('paid') ? 'paid' :
            routing.includes('cloud') ? 'cloud' : 'local';
        const providers = [];
        if (tier === 'local' || tier === 'cloud' || tier === 'paid') {
            providers.push({ name: 'ollama', model: preferredModel || 'qwen2.5-coder:3b', type: 'ollama' }, { name: 'ollama', model: 'llama3.1:8b', type: 'ollama' });
        }
        if (tier === 'cloud' || tier === 'paid') {
            providers.push({ name: 'openrouter', model: preferredModel || 'google/gemini-1.5-flash', type: 'openrouter' }, { name: 'groq', model: 'llama3.1-8b', type: 'groq' });
        }
        if (tier === 'paid') {
            providers.push({ name: 'gemini', model: preferredModel || 'gemini-2.0-flash', type: 'gemini' });
        }
        return providers;
    }
    async callProvider(provider, prompt, system, opts) {
        const start = Date.now();
        switch (provider.type) {
            case 'ollama':
                return this.callOllama(provider.model, prompt, system, opts);
            case 'openrouter':
                return this.callOpenRouter(provider.model, prompt, system, opts);
            case 'gemini':
                return this.callGemini(provider.model, prompt, system, opts);
            case 'groq':
                return this.callGroq(provider.model, prompt, system, opts);
            default:
                return { success: false, error: `Unknown provider`, content: null, duration: 0 };
        }
    }
    async callOllama(model, prompt, system, opts) {
        const start = Date.now();
        try {
            const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    prompt: `${system}\n\n${prompt}`,
                    stream: false,
                    options: { temperature: opts.temperature, num_predict: opts.maxTokens }
                })
            });
            if (!res.ok)
                return { success: false, error: `HTTP ${res.status}`, content: null, duration: Date.now() - start };
            const data = await res.json();
            return { success: true, content: data.response?.trim() || '', duration: Date.now() - start };
        }
        catch (e) {
            return { success: false, error: String(e), content: null, duration: Date.now() - start };
        }
    }
    async callOpenRouter(model, prompt, system, opts) {
        const start = Date.now();
        if (!OPENROUTER_KEY)
            return { success: false, error: 'No API key', content: null, duration: 0 };
        try {
            const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENROUTER_KEY}`
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: system },
                        { role: 'user', content: prompt }
                    ],
                    temperature: opts.temperature,
                    max_tokens: opts.maxTokens
                })
            });
            if (!res.ok)
                return { success: false, error: `HTTP ${res.status}`, content: null, duration: Date.now() - start };
            const data = await res.json();
            const content = data.choices?.[0]?.message?.content?.trim() || '';
            return { success: true, content, duration: Date.now() - start };
        }
        catch (e) {
            return { success: false, error: String(e), content: null, duration: Date.now() - start };
        }
    }
    async callGemini(model, prompt, system, opts) {
        const start = Date.now();
        if (!GEMINI_KEY)
            return { success: false, error: 'No API key', content: null, duration: 0 };
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `${system}\n\n${prompt}` }] }],
                    generationConfig: { temperature: opts.temperature, maxOutputTokens: opts.maxTokens }
                })
            });
            if (!res.ok)
                return { success: false, error: `HTTP ${res.status}`, content: null, duration: Date.now() - start };
            const data = await res.json();
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
            return { success: true, content, duration: Date.now() - start };
        }
        catch (e) {
            return { success: false, error: String(e), content: null, duration: Date.now() - start };
        }
    }
    async callGroq(model, prompt, system, opts) {
        const start = Date.now();
        if (!GROQ_KEY)
            return { success: false, error: 'No API key', content: null, duration: 0 };
        try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROQ_KEY}`
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: system },
                        { role: 'user', content: prompt }
                    ],
                    temperature: opts.temperature,
                    max_tokens: opts.maxTokens
                })
            });
            if (!res.ok)
                return { success: false, error: `HTTP ${res.status}`, content: null, duration: Date.now() - start };
            const data = await res.json();
            const content = data.choices?.[0]?.message?.content?.trim() || '';
            return { success: true, content, duration: Date.now() - start };
        }
        catch (e) {
            return { success: false, error: String(e), content: null, duration: Date.now() - start };
        }
    }
    parseJSONResponse(content) {
        if (!content)
            return null;
        let cleaned = content
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch)
            cleaned = jsonMatch[0];
        try {
            return JSON.parse(cleaned);
        }
        catch {
            // Try fixing common issues
            cleaned = cleaned
                .replace(/,\s*([\]}])/g, '$1')
                .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
            try {
                return JSON.parse(cleaned);
            }
            catch {
                return null;
            }
        }
    }
}
export const llm = new LLMClient();
