export interface LLMResult {
    content: string;
    provider: string;
    model: string;
    duration: number;
}
export declare function generateWithFallback(prompt: string, systemPrompt?: string): Promise<LLMResult>;
export declare function generateCode(prompt: string): Promise<{
    files: {
        path: string;
        content: string;
    }[];
}>;
