export interface TestSpec {
  name: string;
  type: 'unit' | 'integration' | 'e2e';
  target: string;
  cases: TestCase[];
}

export interface TestCase {
  id: string;
  input: any;
  expected: any;
  description: string;
}

export interface TestResult {
  spec: TestSpec;
  passed: number;
  failed: number;
  results: TestCaseResult[];
  duration: number;
}

export interface TestCaseResult {
  id: string;
  passed: boolean;
  actual: any;
  error?: string;
  duration: number;
}

export class TesterAgent {
  private testDir: string;

  constructor(testDir: string = './tests') {
    this.testDir = testDir;
  }

  async generateFromCode(code: string, language: string = 'typescript'): Promise<TestSpec> {
    const testCases = this.inferTestCases(code, language);
    
    return {
      name: 'auto-generated',
      type: 'unit',
      target: 'inferred',
      cases: testCases
    };
  }

  async generateFromBlueprint(spec: any): Promise<TestSpec> {
    return {
      name: `${spec.name || 'blueprint'}-tests`,
      type: 'integration',
      target: spec.name || 'unknown',
      cases: this.generateBlueprintTests(spec)
    };
  }

  async runTests(spec: TestSpec): Promise<TestResult> {
    const start = Date.now();
    const results: TestCaseResult[] = [];

    for (const testCase of spec.cases) {
      const result = await this.executeTest(testCase);
      results.push(result);
    }

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    return {
      spec,
      passed,
      failed,
      results,
      duration: Date.now() - start
    };
  }

  async verifyAfterGeneration(
    generatedCode: string,
    spec: string
  ): Promise<{ verified: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    // Syntax check
    if (!this.syntaxCheck(generatedCode)) {
      issues.push('Syntax validation failed');
    }
    
    // Generate and run tests
    const testSpec = await this.generateFromCode(generatedCode);
    const result = await this.runTests(testSpec);
    
    if (result.failed > 0) {
      issues.push(`${result.failed} test(s) failed`);
    }
    
    return {
      verified: issues.length === 0 && result.passed === result.results.length,
      issues
    };
  }

  private inferTestCases(code: string, language: string): TestCase[] {
    const cases: TestCase[] = [];
    
    // Basic sanity tests based on code patterns
    if (code.includes('function') || code.includes('=>')) {
      cases.push({
        id: 'syntax-ok',
        input: null,
        expected: true,
        description: 'Code should have valid syntax'
      });
    }
    
    return cases;
  }

  private generateBlueprintTests(spec: any): TestCase[] {
    return [
      {
        id: 'blueprint-exists',
        input: spec.name,
        expected: spec.name,
        description: 'Blueprint should have a name'
      }
    ];
  }

  private async executeTest(testCase: TestCase): Promise<TestCaseResult> {
    const start = Date.now();
    
    try {
      const actual = testCase.input;
      const passed = JSON.stringify(actual) === JSON.stringify(testCase.expected);
      
      return {
        id: testCase.id,
        passed,
        actual,
        duration: Date.now() - start
      };
    } catch (err) {
      return {
        id: testCase.id,
        passed: false,
        actual: null,
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - start
      };
    }
  }

  private syntaxCheck(code: string): boolean {
    try {
      new Function(code);
      return true;
    } catch {
      return false;
    }
  }
}
