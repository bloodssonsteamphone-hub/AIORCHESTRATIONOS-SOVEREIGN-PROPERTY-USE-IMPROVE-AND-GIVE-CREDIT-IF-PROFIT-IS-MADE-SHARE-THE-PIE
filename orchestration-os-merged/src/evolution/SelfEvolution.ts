export interface Outcome {
  id: string;
  timestamp: number;
  workflowId: string;
  status: 'success' | 'failure' | 'partial';
  duration: number;
  tokensUsed?: number;
  cost?: number;
  retries: number;
  error?: string;
}

export interface LearnedOptimization {
  id: string;
  pattern: string;
  trigger: string;
  action: string;
  confidence: number;
  successCount: number;
  failureCount: number;
}

export interface RuntimeDiscovery {
  name: string;
  type: 'llm' | 'container' | 'service' | 'script';
  endpoint?: string;
  status: 'available' | 'unavailable';
  latency?: number;
  cost?: number;
}

export interface PromptImprovement {
  id: string;
  original: string;
  improved: string;
  context: string;
  success: boolean;
  timestamp: number;
}

export class SelfEvolution {
  private outcomes: Outcome[] = [];
  private optimizations: LearnedOptimization[] = [];
  private runtimes: RuntimeDiscovery[] = [];
  private promptImprovements: PromptImprovement[] = [];
  private storagePath: string;

  constructor(storagePath: string = './evolution-data.json') {
    this.storagePath = storagePath;
    this.load();
  }

  // --- Outcome Logging ---
  logOutcome(outcome: Omit<Outcome, 'id' | 'timestamp'>): void {
    const entry: Outcome = {
      ...outcome,
      id: `outcome_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };
    this.outcomes.push(entry);
    if (this.outcomes.length > 10000) this.outcomes.shift();
    this.save();
    this.analyzeAndAdapt(entry);
  }

  // --- Pattern Learning ---
  private analyzeAndAdapt(outcome: Outcome): void {
    if (outcome.status === 'failure' && outcome.retries > 0) {
      const existing = this.optimizations.find(
        o => o.pattern === outcome.error && o.trigger === 'retry'
      );
      if (existing) {
        existing.failureCount++;
        existing.confidence = existing.successCount / (existing.successCount + existing.failureCount);
      } else {
        this.optimizations.push({
          id: `opt_${Date.now()}`,
          pattern: outcome.error || 'unknown',
          trigger: 'retry',
          action: 'increase_retry_delay',
          confidence: 0.5,
          successCount: 0,
          failureCount: 1,
        });
      }
    }
    if (outcome.status === 'success') {
      this.optimizations
        .filter(o => o.pattern === outcome.error)
        .forEach(o => {
          o.successCount++;
          o.confidence = o.successCount / (o.successCount + o.failureCount);
        });
    }
  }

  // --- Runtime Discovery ---
  async discoverRuntimes(): Promise<RuntimeDiscovery[]> {
    const checks: Promise<RuntimeDiscovery>[] = [
      this.checkOllama(),
      this.checkDocker(),
      this.checkOpenAI(),
      this.checkAnthropic(),
      this.checkGroq(),
    ];
    this.runtimes = await Promise.all(checks);
    return this.runtimes.filter(r => r.status === 'available');
  }

  private async checkOllama(): Promise<RuntimeDiscovery> {
    try {
      const start = Date.now();
      const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
      const latency = Date.now() - start;
      if (res.ok) {
        const data = await res.json() as { models?: { name: string }[] };
        const models = data.models?.map((m: { name: string }) => m.name) || [];
        return { name: 'ollama', type: 'llm', endpoint: 'http://localhost:11434', status: 'available', latency, models: models as unknown as string[] } as unknown as RuntimeDiscovery;
      }
    } catch {}
    return { name: 'ollama', type: 'llm', endpoint: 'http://localhost:11434', status: 'unavailable' };
  }

  private async checkDocker(): Promise<RuntimeDiscovery> {
    try {
      const start = Date.now();
      const res = await fetch('http://localhost:2375/version', { signal: AbortSignal.timeout(2000) });
      const latency = Date.now() - start;
      if (res.ok) return { name: 'docker', type: 'container', endpoint: 'http://localhost:2375', status: 'available', latency };
    } catch {}
    return { name: 'docker', type: 'container', status: 'unavailable' };
  }

  private async checkOpenAI(): Promise<RuntimeDiscovery> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return { name: 'openai', type: 'llm', status: 'unavailable' };
    try {
      const start = Date.now();
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(3000),
      });
      const latency = Date.now() - start;
      if (res.ok) return { name: 'openai', type: 'llm', status: 'available', latency, cost: 0.002 };
    } catch {}
    return { name: 'openai', type: 'llm', status: 'unavailable' };
  }

  private async checkAnthropic(): Promise<RuntimeDiscovery> {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return { name: 'anthropic', type: 'llm', status: 'unavailable' };
    try {
      const start = Date.now();
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: { 'x-api-key': key },
        signal: AbortSignal.timeout(3000),
      });
      const latency = Date.now() - start;
      if (res.ok) return { name: 'anthropic', type: 'llm', status: 'available', latency, cost: 0.015 };
    } catch {}
    return { name: 'anthropic', type: 'llm', status: 'unavailable' };
  }

  private async checkGroq(): Promise<RuntimeDiscovery> {
    const key = process.env.GROQ_API_KEY;
    if (!key) return { name: 'groq', type: 'llm', status: 'unavailable' };
    try {
      const start = Date.now();
      const res = await fetch('https://api.groq.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(3000),
      });
      const latency = Date.now() - start;
      if (res.ok) return { name: 'groq', type: 'llm', status: 'available', latency, cost: 0.0001 };
    } catch {}
    return { name: 'groq', type: 'llm', status: 'unavailable' };
  }

  // --- Prompt Improvement ---
  async improvePrompt(original: string, context: string): Promise<string> {
    const improvement: PromptImprovement = {
      id: `prompt_${Date.now()}`,
      original,
      improved: original,
      context,
      success: false,
      timestamp: Date.now(),
    };
    // Look for similar successful prompts
    const similar = this.promptImprovements.filter(
      p => p.success && (p.context === context || this.similarity(p.context, context) > 0.7)
    );
    if (similar.length > 0) {
      improvement.improved = similar[similar.length - 1].improved;
    }
    this.promptImprovements.push(improvement);
    return improvement.improved;
  }

  private similarity(a: string, b: string): number {
    const aWords = new Set(a.toLowerCase().split(/\s+/));
    const bWords = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...aWords].filter(x => bWords.has(x)));
    const union = new Set([...aWords, ...bWords]);
    return intersection.size / union.size;
  }

  // --- Analytics ---
  getStats() {
    const total = this.outcomes.length;
    const success = this.outcomes.filter(o => o.status === 'success').length;
    const failure = this.outcomes.filter(o => o.status === 'failure').length;
    const totalCost = this.outcomes.reduce((sum, o) => sum + (o.cost || 0), 0);
    const totalTokens = this.outcomes.reduce((sum, o) => sum + (o.tokensUsed || 0), 0);
    const avgDuration = total > 0 ? this.outcomes.reduce((sum, o) => sum + o.duration, 0) / total : 0;
    return {
      total,
      success,
      failure,
      partial: total - success - failure,
      successRate: total > 0 ? success / total : 0,
      totalCost,
      totalTokens,
      avgDurationMs: avgDuration,
      availableRuntimes: this.runtimes.filter(r => r.status === 'available').length,
      optimizations: this.optimizations.length,
    };
  }

  // --- Persistence ---
  private save(): void {
    try {
      const data = JSON.stringify({
        outcomes: this.outcomes.slice(-1000),
        optimizations: this.optimizations,
        runtimes: this.runtimes,
        promptImprovements: this.promptImprovements.slice(-100),
      }, null, 2);
      // For Node.js environment, would write to file
      // fs.writeFileSync(this.storagePath, data);
    } catch {}
  }

  private load(): void {
    try {
      // For Node.js environment, would read from file
      // if (fs.existsSync(this.storagePath)) { ... }
    } catch {}
  }
}

export const evolution = new SelfEvolution();
