export type DiagnosticSeverity = 'critical' | 'warning' | 'info';

export interface DiagnosticResult {
  id: string;
  name: string;
  severity: DiagnosticSeverity;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
  repairable: boolean;
}

export interface RepairAction {
  diagnosticId: string;
  action: string;
  command?: string;
  script?: string;
  autoRepair: boolean;
}

export class SelfDiagnosis {
  private diagnostics: Map<string, () => Promise<DiagnosticResult>> = new Map();
  private repairScripts: Map<string, () => Promise<boolean>> = new Map();
  private lastResults: DiagnosticResult[] = [];

  constructor() {
    this.registerDefaultDiagnostics();
  }

  private registerDefaultDiagnostics() {
    // GitHub Connection
    this.register('github-connection', async () => {
      try {
        const proc = await Deno.run({
          cmd: ['gh', 'auth', 'status'],
          stdout: 'piped',
          stderr: 'piped',
        }).output();
        const output = new TextDecoder().decode(proc);
        return {
          id: 'github-connection',
          name: 'GitHub Authentication',
          severity: 'critical',
          status: output.includes('Logged in') ? 'pass' : 'fail',
          message: output.includes('Logged in')
            ? 'GitHub CLI authenticated'
            : 'Not authenticated with GitHub',
          repairable: true,
          timestamp: Date.now(),
        };
      } catch {
        return {
          id: 'github-connection',
          name: 'GitHub CLI',
          severity: 'critical',
          status: 'fail',
          message: 'GitHub CLI not found or not functional',
          repairable: true,
          timestamp: Date.now(),
        };
      }
    });

    // Docker
    this.register('docker', async () => {
      try {
        const proc = await Deno.run({
          cmd: ['docker', 'info'],
          stdout: 'piped',
          stderr: 'piped',
        });
        const output = await new TextDecoder().decode(await proc.output());
        return {
          id: 'docker',
          name: 'Docker',
          severity: 'critical',
          status: proc.close() === undefined && output.includes('Server Version') ? 'pass' : 'fail',
          message: 'Docker daemon is running',
          repairable: false,
          timestamp: Date.now(),
        };
      } catch {
        return {
          id: 'docker',
          name: 'Docker',
          severity: 'critical',
          status: 'fail',
          message: 'Docker is not running or not installed',
          repairable: false,
          timestamp: Date.now(),
        };
      }
    });

    // Node.js
    this.register('nodejs', async () => {
      try {
        const proc = await Deno.run({
          cmd: ['node', '--version'],
          stdout: 'piped',
        });
        const version = new TextDecoder().decode(await proc.output());
        await proc.close();
        return {
          id: 'nodejs',
          name: 'Node.js',
          severity: 'warning',
          status: 'pass',
          message: `Node.js ${version.trim()}`,
          repairable: false,
          timestamp: Date.now(),
        };
      } catch {
        return {
          id: 'nodejs',
          name: 'Node.js',
          severity: 'warning',
          status: 'fail',
          message: 'Node.js not found',
          repairable: true,
          timestamp: Date.now(),
        };
      }
    });

    // Disk Space
    this.register('disk-space', async () => {
      try {
        const proc = await Deno.run({
          cmd: ['df', '-h', '/'],
          stdout: 'piped',
        });
        const output = new TextDecoder().decode(await proc.output());
        await proc.close();
        const match = output.match(/(\d+)%/);
        const usage = match ? parseInt(match[1]) : 0;
        return {
          id: 'disk-space',
          name: 'Disk Space',
          severity: usage > 90 ? 'critical' : usage > 75 ? 'warning' : 'info',
          status: usage > 90 ? 'fail' : usage > 75 ? 'warn' : 'pass',
          message: `Disk usage: ${usage}%`,
          details: { usagePercent: usage },
          repairable: false,
          timestamp: Date.now(),
        };
      } catch {
        return {
          id: 'disk-space',
          name: 'Disk Space',
          severity: 'warning',
          status: 'warn',
          message: 'Could not determine disk usage',
          repairable: false,
          timestamp: Date.now(),
        };
      }
    });

    // Memory
    this.register('memory', async () => {
      try {
        const proc = await Deno.run({
          cmd: ['free', '-m'],
          stdout: 'piped',
        });
        const output = new TextDecoder().decode(await proc.output());
        await proc.close();
        const match = output.match(/Mem:\s+(\d+)\s+(\d+)/);
        const total = match ? parseInt(match[1]) : 0;
        const used = match ? parseInt(match[2]) : 0;
        const usage = total > 0 ? Math.round((used / total) * 100) : 0;
        return {
          id: 'memory',
          name: 'Memory',
          severity: usage > 90 ? 'critical' : usage > 75 ? 'warning' : 'info',
          status: usage > 90 ? 'fail' : usage > 75 ? 'warn' : 'pass',
          message: `Memory usage: ${usage}% (${used}MB/${total}MB)`,
          details: { used, total, usagePercent: usage },
          repairable: false,
          timestamp: Date.now(),
        };
      } catch {
        return {
          id: 'memory',
          name: 'Memory',
          severity: 'warning',
          status: 'warn',
          message: 'Could not determine memory usage',
          repairable: false,
          timestamp: Date.now(),
        };
      }
    });

    // Network
    this.register('network', async () => {
      try {
        const proc = await Deno.run({
          cmd: ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', 'https://api.github.com'],
          stdout: 'piped',
        });
        const code = new TextDecoder().decode(await proc.output());
        await proc.close();
        const status = code === '200' ? 'pass' : 'fail';
        return {
          id: 'network',
          name: 'Network',
          severity: status === 'fail' ? 'critical' : 'info',
          status,
          message: status === 'pass' ? 'Network connectivity OK' : `Network issue (HTTP ${code})`,
          repairable: false,
          timestamp: Date.now(),
        };
      } catch {
        return {
          id: 'network',
          name: 'Network',
          severity: 'critical',
          status: 'fail',
          message: 'Network connectivity failed',
          repairable: false,
          timestamp: Date.now(),
        };
      }
    });
  }

  register(id: string, fn: () => Promise<DiagnosticResult>) {
    this.diagnostics.set(id, fn);
  }

  registerRepair(id: string, fn: () => Promise<boolean>) {
    this.repairScripts.set(id, fn);
  }

  async runAll(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];
    for (const [id, fn] of this.diagnostics) {
      try {
        const result = await fn();
        results.push(result);
      } catch (e) {
        results.push({
          id,
          name: id,
          severity: 'critical',
          status: 'fail',
          message: `Diagnostic error: ${e.message}`,
          repairable: false,
          timestamp: Date.now(),
        });
      }
    }
    this.lastResults = results;
    return results;
  }

  async repair(diagnosticId: string): Promise<{ success: boolean; message: string }> {
    const repairFn = this.repairScripts.get(diagnosticId);
    if (!repairFn) {
      return { success: false, message: 'No repair script available' };
    }
    try {
      const success = await repairFn();
      return {
        success,
        message: success ? 'Repair successful' : 'Repair failed',
      };
    } catch (e) {
      return { success: false, message: `Repair error: ${e.message}` };
    }
  }

  async autoRepair(): Promise<{ repaired: string[]; failed: string[] }> {
    const toRepair = this.lastResults.filter(r => r.status === 'fail' && r.repairable);
    const repaired: string[] = [];
    const failed: string[] = [];

    for (const diag of toRepair) {
      const result = await this.repair(diag.id);
      if (result.success) {
        repaired.push(diag.id);
      } else {
        failed.push(diag.id);
      }
    }

    return { repaired, failed };
  }

  getSummary() {
    const results = this.lastResults;
    return {
      total: results.length,
      passed: results.filter(r => r.status === 'pass').length,
      warnings: results.filter(r => r.status === 'warn').length,
      failed: results.filter(r => r.status === 'fail').length,
      repairableFailed: results.filter(r => r.status === 'fail' && r.repairable).length,
    };
  }
}

export default SelfDiagnosis;
