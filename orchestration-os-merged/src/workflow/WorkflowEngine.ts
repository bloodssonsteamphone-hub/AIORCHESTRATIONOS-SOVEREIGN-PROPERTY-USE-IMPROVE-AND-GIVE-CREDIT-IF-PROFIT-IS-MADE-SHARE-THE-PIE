// Layer 4 — Workflow Engine (DAG + Triggers)
import { exec } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type HookType = 'http' | 'mq' | 'fs' | 'cli' | 'timer';
export type TriggerType = 'manual' | 'cron' | 'event' | 'webhook';

export interface WorkflowHook {
  type: HookType;
  config: Record<string, any>;
  enabled: boolean;
}

export interface WorkflowStep {
  id: string;
  name: string;
  action: string;
  input: Record<string, any>;
  retry?: number;
  timeout?: number;
  onError?: 'continue' | 'abort' | 'retry';
}

export interface Workflow {
  id: string;
  name: string;
  version: string;
  trigger: {
    type: TriggerType;
    config: Record<string, any>;
  };
  steps: WorkflowStep[];
  hooks?: {
    before?: WorkflowHook[];
    after?: WorkflowHook[];
    onError?: WorkflowHook[];
  };
  dag?: DAGConfig;
}

export interface DAGConfig {
  nodes: string[];
  edges: [string, string][];
}

export interface WorkflowResult {
  workflow: Workflow;
  success: boolean;
  executedSteps: ExecutedStep[];
  failedStep?: ExecutedStep;
  duration: number;
  output?: any;
}

export interface ExecutedStep {
  stepId: string;
  success: boolean;
  output?: any;
  error?: string;
  duration: number;
  retries: number;
}

export type WorkflowExecutor = (step: WorkflowStep, context: ExecutionContext) => Promise<any>;

export interface ExecutionContext {
  workflowId: string;
  runId: string;
  inputs: Record<string, any>;
  state: Record<string, any>;
  results: Map<string, any>;
}

export class WorkflowEngine {
  private executors: Map<string, WorkflowExecutor> = new Map();
  private workflows: Map<string, Workflow> = new Map();
  private cronJobs: Map<string, NodeJS.Timeout> = new Map();

  registerExecutor(action: string, executor: WorkflowExecutor): void {
    this.executors.set(action, executor);
  }

  async loadWorkflow(workflow: Workflow): Promise<void> {
    this.workflows.set(workflow.id, workflow);
    if (workflow.trigger.type === 'cron') {
      this.scheduleCron(workflow);
    }
  }

  async unloadWorkflow(id: string): Promise<void> {
    this.workflows.delete(id);
    const cron = this.cronJobs.get(id);
    if (cron) {
      clearTimeout(cron);
      this.cronJobs.delete(id);
    }
  }

  async execute(workflowId: string, inputs: Record<string, any> = {}): Promise<WorkflowResult> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const start = Date.now();
    const context: ExecutionContext = {
      workflowId,
      runId: `run-${Date.now()}`,
      inputs,
      state: {},
      results: new Map(),
    };

    const executedSteps: ExecutedStep[] = [];

    try {
      await this.runHooks(workflow.hooks?.before, context);

      if (workflow.dag) {
        const dagResult = await this.executeDAG(workflow, context);
        if (!dagResult.success && workflow.hooks?.onError) {
          await this.runHooks(workflow.hooks.onError, context);
        }
        await this.runHooks(workflow.hooks?.after, context);
        return {
          workflow,
          success: dagResult.success,
          executedSteps: dagResult.steps,
          failedStep: dagResult.failedStep,
          duration: Date.now() - start,
          output: dagResult.output,
        };
      }

      for (const step of workflow.steps) {
        const result = await this.executeStep(step, context);
        executedSteps.push(result);

        if (!result.success && step.onError === 'abort') {
          if (workflow.hooks?.onError) {
            await this.runHooks(workflow.hooks.onError, context);
          }
          return {
            workflow,
            success: false,
            executedSteps,
            failedStep: result,
            duration: Date.now() - start,
          };
        }
      }

      await this.runHooks(workflow.hooks?.after, context);

      return {
        workflow,
        success: true,
        executedSteps,
        duration: Date.now() - start,
      };
    } catch (err) {
      if (workflow.hooks?.onError) {
        await this.runHooks(workflow.hooks.onError, context);
      }
      return {
        workflow,
        success: false,
        executedSteps,
        duration: Date.now() - start,
      };
    }
  }

  private async executeDAG(
    workflow: Workflow,
    context: ExecutionContext
  ): Promise<{ success: boolean; steps: ExecutedStep[]; failedStep?: ExecutedStep; output?: any }> {
    const { nodes, edges } = workflow.dag!;
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const node of nodes) {
      inDegree.set(node, 0);
      adjacency.set(node, []);
    }
    for (const [from, to] of edges) {
      adjacency.get(from)!.push(to);
      inDegree.set(to, inDegree.get(to)! + 1);
    }

    const stepMap = new Map(workflow.steps.map(s => [s.id, s]));
    const executedSteps: ExecutedStep[] = [];
    const queue: string[] = [];

    for (const [node, degree] of inDegree) {
      if (degree === 0) queue.push(node);
    }

    while (queue.length > 0) {
      const node = queue.shift()!;
      const step = stepMap.get(node);
      if (!step) continue;

      const result = await this.executeStep(step, context);
      executedSteps.push(result);

      if (!result.success && step.onError === 'abort') {
        return { success: false, steps: executedSteps, failedStep: result };
      }

      for (const neighbor of adjacency.get(node) || []) {
        inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    return { success: true, steps: executedSteps };
  }

  private async executeStep(step: WorkflowStep, context: ExecutionContext): Promise<ExecutedStep> {
    const start = Date.now();
    let retries = 0;
    const maxRetries = step.retry ?? 0;

    while (true) {
      try {
        const executor = this.executors.get(step.action);
        if (!executor) {
          throw new Error(`No executor for action: ${step.action}`);
        }

        const output = await executor(step, context);
        context.results.set(step.id, output);

        return {
          stepId: step.id,
          success: true,
          output,
          duration: Date.now() - start,
          retries,
        };
      } catch (err) {
        if (retries < maxRetries) {
          retries++;
          continue;
        }
        return {
          stepId: step.id,
          success: false,
          error: err instanceof Error ? err.message : String(err),
          duration: Date.now() - start,
          retries,
        };
      }
    }
  }

  private async runHooks(hooks: WorkflowHook[] | undefined, context: ExecutionContext): Promise<void> {
    if (!hooks) return;
    for (const hook of hooks) {
      if (!hook.enabled) continue;
      await this.executeHook(hook, context);
    }
  }

  private async executeHook(hook: WorkflowHook, context: ExecutionContext): Promise<void> {
    switch (hook.type) {
      case 'http':
        await fetch(hook.config.url, {
          method: 'POST',
          body: JSON.stringify(context.state),
        });
        break;
      case 'cli':
        await execAsync(hook.config.command);
        break;
      case 'fs':
        if (hook.config.write) {
          writeFileSync(hook.config.path, JSON.stringify(context.state));
        }
        break;
    }
  }

  private scheduleCron(workflow: Workflow): void {
    const { cron } = workflow.trigger.config as { cron: string };
    const interval = this.cronToMs(cron);
    const timeout = setInterval(() => this.execute(workflow.id), interval);
    this.cronJobs.set(workflow.id, timeout);
  }

  private cronToMs(cron: string): number {
    const parts = cron.trim().split(/\s+/);
    if (parts.length < 5) return 60000;
    return 60000;
  }

  reloadWorkflows(): void {
    for (const [id] of this.workflows) {
      const workflow = this.workflows.get(id)!;
      if (workflow.trigger.type === 'cron') {
        this.scheduleCron(workflow);
      }
    }
  }
}
