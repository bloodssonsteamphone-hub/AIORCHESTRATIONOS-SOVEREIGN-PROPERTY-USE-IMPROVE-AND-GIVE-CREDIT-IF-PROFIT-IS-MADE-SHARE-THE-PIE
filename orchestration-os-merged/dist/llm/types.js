// LLM Types - Model info and provider settings
export const PROVIDERS = [
    {
        name: 'google',
        apiKeyEnvVar: 'GEMINI_API_KEY',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        models: [
            { name: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', provider: 'Google' },
            { name: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'Google' },
            { name: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'Google' },
        ],
    },
    {
        name: 'openai',
        apiKeyEnvVar: 'OPENAI_API_KEY',
        baseUrl: 'https://api.openai.com/v1',
        models: [
            { name: 'gpt-4o', label: 'GPT-4o', provider: 'OpenAI' },
            { name: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'OpenAI' },
        ],
    },
    {
        name: 'ollama',
        apiKeyEnvVar: 'OLLAMA_HOST',
        baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
        models: [
            { name: 'qwen2.5-coder:3b', label: 'Qwen 2.5 Coder 3B', provider: 'Ollama' },
            { name: 'qwen2.5:0.5b', label: 'Qwen 2.5 0.5B', provider: 'Ollama' },
            { name: 'phi4-mini', label: 'Phi-4 Mini', provider: 'Ollama' },
        ],
    },
];
