// LLM Client - Multi-provider with fallback
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY || '',
});
const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
});
const ollamaBaseUrl = (process.env.OLLAMA_HOST || 'http://localhost:11434') + '/v1';
const ollama = createOpenAI({
    baseURL: ollamaBaseUrl,
    apiKey: 'ollama', // Ollama doesn't need a real key
});
export async function generateWithFallback(prompt, systemPrompt) {
    const startTime = Date.now();
    // Try each provider in order of preference
    const providers = [
        { name: 'google', client: google, model: 'gemini-2.0-flash' },
        { name: 'google', client: google, model: 'gemini-2.5-flash' },
        { name: 'openai', client: openai, model: 'gpt-4o-mini' },
        { name: 'ollama', client: ollama, model: 'qwen2.5-coder:3b' },
    ];
    for (const { name, client, model } of providers) {
        try {
            console.log(`Trying ${name}/${model}...`);
            const result = await generateText({
                model: client.languageModel(model),
                system: systemPrompt,
                prompt,
                maxTokens: 8192,
            });
            return {
                content: result.text,
                provider: name,
                model,
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            console.log(`❌ ${name}/${model} failed: ${error.message || error}`);
            continue;
        }
    }
    throw new Error('All LLM providers failed');
}
export async function generateCode(prompt) {
    const systemPrompt = `You are an expert full-stack developer. Generate code based on the user's request.

CRITICAL OUTPUT FORMAT - Return ONLY valid JSON, no markdown or explanation:
{
  "files": [
    {
      "path": "relative/path/to/file.js",
      "content": "file content here"
    }
  ]
}

Rules:
- Return RAW JSON only, no markdown code blocks, no backticks
- content should be the actual file content as a string
- Include all necessary files (package.json, server, components, etc.)
- Keep code simple but functional`;
    const result = await generateWithFallback(prompt, systemPrompt);
    return parseCodeResponse(result.content);
}
function parseCodeResponse(content) {
    // Try direct JSON parse first
    try {
        const parsed = JSON.parse(content);
        if (parsed.files && Array.isArray(parsed.files)) {
            return parsed;
        }
    }
    catch { }
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[1].trim());
            if (parsed.files && Array.isArray(parsed.files)) {
                return parsed;
            }
        }
        catch { }
    }
    // Try to find any JSON object with files array
    const filesMatch = content.match(/"files"\s*:\s*\[/);
    if (filesMatch) {
        const startIdx = content.indexOf('"files"');
        // Find matching closing bracket
        let depth = 0;
        let endIdx = startIdx;
        for (let i = startIdx; i < content.length; i++) {
            if (content[i] === '[')
                depth++;
            else if (content[i] === ']') {
                depth--;
                if (depth === 0) {
                    endIdx = i + 1;
                    break;
                }
            }
        }
        try {
            const parsed = JSON.parse(content.substring(startIdx - 1, endIdx));
            if (parsed.files) {
                return parsed;
            }
        }
        catch { }
    }
    throw new Error('Could not parse code response');
}
