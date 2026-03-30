export interface ModelInfo {
    name: string;
    label: string;
    provider: string;
    maxTokenAllowed?: number;
    maxCompletionTokens?: number;
}
export interface LLMProvider {
    name: string;
    apiKeyEnvVar: string;
    baseUrl?: string;
    models: ModelInfo[];
}
export declare const PROVIDERS: LLMProvider[];
