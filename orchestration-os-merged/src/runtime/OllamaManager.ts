export interface OllamaModel {
  name: string;
  model: string;
  size: number;
  digest: string;
  parameter_size: string;
  quantization_level: string;
}

export interface OllamaStatus {
  running: boolean;
  models: OllamaModel[];
  endpoint: string;
}

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

export async function checkOllamaStatus(): Promise<OllamaStatus> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { models: OllamaModel[] };
    return { running: true, models: data.models || [], endpoint: OLLAMA_URL };
  } catch {
    return { running: false, models: [], endpoint: OLLAMA_URL };
  }
}

export async function ollamaGenerate(model: string, prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama generate failed: HTTP ${res.status}`);
  const data = await res.json();
  return data.response || '';
}

export async function ollamaChat(model: string, messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama chat failed: HTTP ${res.status}`);
  const data = await res.json();
  return data.message?.content || '';
}

export async function ollamaEmbeddings(model: string, prompt: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt }),
  });
  if (!res.ok) throw new Error(`Ollama embeddings failed: HTTP ${res.status}`);
  const data = await res.json();
  return data.embedding || [];
}

export const OLLAMA_MODELS = {
  CODE: 'qwen2.5-coder:3b',
  GENERAL: 'phi4-mini:latest',
  TINY: 'qwen2.5:0.5b',
} as const;
