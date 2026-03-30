import type { LLMConfig, LLMResponse } from './types.js';
export declare class LLMClient {
    generate(prompt: string, system?: string, config?: Partial<LLMConfig>): Promise<LLMResponse>;
    private getProviders;
    private callProvider;
    private callOllama;
    private callOpenRouter;
    private callGemini;
    private callGroq;
    parseJSONResponse(content: string): unknown;
}
export declare const llm: LLMClient;
