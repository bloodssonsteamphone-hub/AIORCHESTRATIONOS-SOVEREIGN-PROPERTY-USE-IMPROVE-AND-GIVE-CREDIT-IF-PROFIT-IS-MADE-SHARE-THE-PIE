export type LLMProvider = 'openai' | 'anthropic' | 'groq' | 'cerebras' | 'ollama' | 'local';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseURL?: string;
  maxTokens?: number;
  temperature?: number;
  maxCostPer1K?: number;
}

export interface RoutingRule {
  pattern: RegExp;
  provider: LLMProvider;
  model: string;
  maxCostPer1K?: number;
  latencyTarget?: number;
  contextWindow?: number;
  priority: number;
}

export interface RoutingDecision {
  provider: LLMProvider;
  model: string;
  estimatedCost: number;
  latency: number;
  reason: string;
}

export class L8Router {
  private rules: RoutingRule[] = [];
  private providerConfigs: Map<LLMProvider, LLMConfig> = new Map();
  private fallbackProvider: LLMProvider = 'openai';
  private fallbackModel = 'gpt-4o-mini';

  constructor(
    private apiKeys: Record<string, string>,
    private budgetMode: 'cost' | 'latency' | 'quality' = 'cost'
  ) {
    this.initProviderConfigs();
    this.initDefaultRules();
  }

  private initProviderConfigs() {
    this.providerConfigs.set('groq', {
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      baseURL: 'https://api.groq.com/openai/v1',
      maxCostPer1K: 0.0012,
    });

    this.providerConfigs.set('cerebras', {
      provider: 'cerebras',
      model: 'cerebras/llama-3.3-70b',
      baseURL: 'https://api.cerebras.ai/v1',
      maxCostPer1K: 0.0012,
    });

    this.providerConfigs.set('openai', {
      provider: 'openai',
      model: 'gpt-4o-mini',
      maxCostPer1K: 0.00015,
    });

    this.providerConfigs.set('anthropic', {
      provider: 'anthropic',
      model: 'claude-3-5-haiku-20241022',
      maxCostPer1K: 0.0008,
    });

    this.providerConfigs.set('ollama', {
      provider: 'ollama',
      model: 'llama3.2',
      baseURL: 'http://localhost:11434/v1',
      maxCostPer1K: 0,
    });
  }

  private initDefaultRules() {
    this.rules.push({
      pattern: /^`{3}(\w+)?|^\s*(function|class|const|let|var|import|export|def |fn |pub |async)/m,
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      priority: 1,
      latencyTarget: 500,
    });

    this.rules.push({
      pattern: /^(what|who|when|where|why|how)\s/i,
      provider: 'cerebras',
      model: 'cerebras/llama-3.3-70b',
      priority: 2,
      contextWindow: 4096,
    });

    this.rules.push({
      pattern: /(agent|skill|tool|execute|run|orchestrat)/i,
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      priority: 3,
    });

    this.rules.push({
      pattern: /(analyze|reason|think|plan|strategy|research)/i,
      provider: 'openai',
      model: 'gpt-4o',
      priority: 4,
      latencyTarget: 5000,
    });

    this.rules.push({
      pattern: /(review|refactor|improve|optimize|fix|debug)/i,
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      priority: 5,
    });

    this.rules.sort((a, b) => a.priority - b.priority);
  }

  addRule(rule: Omit<RoutingRule, 'priority'>) {
    const priority = this.rules.length + 1;
    this.rules.push({ ...rule, priority });
  }

  async route(prompt: string): Promise<RoutingDecision> {
    for (const rule of this.rules) {
      if (rule.pattern.test(prompt)) {
        const config = this.providerConfigs.get(rule.provider)!;
        return {
          provider: rule.provider,
          model: rule.model || config.model,
          estimatedCost: rule.maxCostPer1K || config.maxCostPer1K || 0,
          latency: rule.latencyTarget || 1000,
          reason: `Matched rule ${rule.priority}: ${rule.pattern.source}`,
        };
      }
    }
    return this.fallback();
  }

  private fallback(): RoutingDecision {
    switch (this.budgetMode) {
      case 'cost':
        return {
          provider: 'groq',
          model: 'llama-3.3-70b-versatile',
          estimatedCost: 0.0012,
          latency: 800,
          reason: 'Fallback: cheapest option',
        };
      case 'latency':
        return {
          provider: 'cerebras',
          model: 'cerebras/llama-3.3-70b',
          estimatedCost: 0.0012,
          latency: 400,
          reason: 'Fallback: fastest option',
        };
      case 'quality':
        return {
          provider: 'openai',
          model: 'gpt-4o',
          estimatedCost: 0.003,
          latency: 3000,
          reason: 'Fallback: highest quality',
        };
    }
  }

  async routeWithFallback(
    prompt: string,
    tryProviders: LLMProvider[] = ['groq', 'cerebras', 'openai']
  ): Promise<RoutingDecision> {
    const primary = await this.route(prompt);
    try {
      await this.healthCheck(primary.provider);
      return primary;
    } catch {
      for (const provider of tryProviders) {
        if (provider === primary.provider) continue;
        const config = this.providerConfigs.get(provider);
        if (config) {
          try {
            await this.healthCheck(provider);
            return {
              provider,
              model: config.model,
              estimatedCost: config.maxCostPer1K || 0,
              latency: 1000,
              reason: `Fallback from ${primary.provider} to ${provider}`,
            };
          } catch {
            continue;
          }
        }
      }
      return {
        provider: this.fallbackProvider,
        model: this.fallbackModel,
        estimatedCost: 0.003,
        latency: 5000,
        reason: 'All providers failed, using fallback',
      };
    }
  }

  private async healthCheck(provider: LLMProvider): Promise<boolean> {
    const config = this.providerConfigs.get(provider);
    if (!config) throw new Error(`Unknown provider: ${provider}`);
    if (provider === 'ollama') {
      const response = await fetch('http://localhost:11434/api/tags');
      if (!response.ok) throw new Error(`Ollama health check failed: ${response.status}`);
      return true;
    }
    return true;
  }

  getStats() {
    return {
      rulesCount: this.rules.length,
      providers: Array.from(this.providerConfigs.entries()).map(([key, val]) => ({
        provider: key,
        model: val.model,
        costPer1K: val.maxCostPer1K,
      })),
      budgetMode: this.budgetMode,
    };
  }
}

export default L8Router;
