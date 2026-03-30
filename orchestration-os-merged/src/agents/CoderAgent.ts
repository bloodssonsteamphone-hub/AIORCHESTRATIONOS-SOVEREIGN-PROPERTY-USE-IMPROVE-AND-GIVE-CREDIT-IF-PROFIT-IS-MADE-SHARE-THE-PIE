export interface CoderConfig {
  maxRetries: number;
  timeout: number;
  verbose: boolean;
}

export interface CodeResult {
  success: boolean;
  output: string;
  error?: string;
  attempts: number;
  fixed: boolean;
}

export class CoderAgent {
  private config: CoderConfig;
  private diagnostics: any;

  constructor(config: Partial<CoderConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      timeout: config.timeout ?? 30000,
      verbose: config.verbose ?? false
    };
  }

  async generate(spec: string, context?: Record<string, any>): Promise<CodeResult> {
    let lastError: string = '';
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      this.log(`Attempt ${attempt}/${this.config.maxRetries}`);
      
      try {
        const result = await this.executeWithTimeout(
          this.generateCode(spec, context, attempt),
          this.config.timeout
        );
        
        if (result.success) {
          return { ...result, attempts: attempt, fixed: attempt > 1 };
        }
        
        lastError = result.error || 'Unknown error';
        this.log(`Attempt ${attempt} failed: ${lastError}`);
        
        if (attempt < this.config.maxRetries) {
          context = { ...context, lastError, attempt };
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        this.log(`Attempt ${attempt} threw: ${lastError}`);
      }
    }
    
    return {
      success: false,
      output: '',
      error: `Failed after ${this.config.maxRetries} attempts: ${lastError}`,
      attempts: this.config.maxRetries,
      fixed: false
    };
  }

  private async generateCode(
    spec: string,
    context: Record<string, any> | undefined,
    attempt: number
  ): Promise<{ success: boolean; output: string; error?: string }> {
    // Implementation would call LLM via L8Router
    // For now, return placeholder structure
    return {
      success: true,
      output: `// Generated on attempt ${attempt}\n${spec}`
    };
  }

  private async executeWithTimeout<T>(
    promise: Promise<T>,
    ms: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
      )
    ]);
  }

  private log(msg: string): void {
    if (this.config.verbose) {
      console.log(`[CoderAgent] ${msg}`);
    }
  }

  setDiagnostics(diagnostics: any): void {
    this.diagnostics = diagnostics;
  }
}
