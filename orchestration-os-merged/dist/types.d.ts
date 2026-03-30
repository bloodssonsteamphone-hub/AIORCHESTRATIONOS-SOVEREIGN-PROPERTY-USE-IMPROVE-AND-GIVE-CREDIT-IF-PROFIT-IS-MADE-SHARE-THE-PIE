export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface LLMConfig {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    routing?: 'local-free' | 'cloud-free' | 'paid-explicit';
}
export interface LLMResponse {
    success: boolean;
    content: string | null;
    error?: string;
    duration: number;
    model?: string;
    provider?: string;
}
export interface Session {
    id: string;
    idea: string;
    files: FileOutput[];
    status: 'pending' | 'running' | 'success' | 'failure';
    error?: string;
    duration?: number;
    retries: number;
    createdAt: number;
}
export interface FileOutput {
    path: string;
    content: string;
}
