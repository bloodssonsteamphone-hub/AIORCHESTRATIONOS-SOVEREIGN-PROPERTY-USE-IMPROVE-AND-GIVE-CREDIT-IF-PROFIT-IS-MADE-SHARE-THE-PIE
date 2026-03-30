// Layer 3 — Workflow Tools (workflow.*)
// Phase 3: workflow.define, workflow.run, workflow.status, workflow.stop

import { readFileSync } from 'fs';
import { join } from 'path';

let _workflowEngineRef: any = null;
export function setWorkflowEngineRef(ref: any) { _workflowEngineRef = ref; }

export const workflowTool = {
  name: 'workflow',
  category: 'workflow' as const,
  description: 'Define, run, inspect, and stop workflow executions',
  capabilities: ['define', 'run', 'status', 'stop', 'list', 'get-result'],
  metrics: { invocations: 0, successes: 0, failures: 0, avgDuration: 0 },
  invoke: async (params: Record<string, unknown>) => {
    const start = Date.now();
    const { action, workflowId, definition, params: wfParams } = params as {
      action: string; workflowId?: string; definition?: any; params?: Record<string, unknown>;
    };
    const engine = _workflowEngineRef;
    try {
      switch (action) {
        case 'define': {
          if (!definition) throw new Error('definition required for workflow.define');
          if (engine?.registerWorkflow) {
            engine.registerWorkflow(definition);
            return { success: true, data: { id: definition.id, message: 'Workflow registered' }, duration: Date.now() - start };
          }
          return { success: true, data: { id: definition.id, message: 'Workflow defined (engine not yet running)' }, duration: Date.now() - start };
        }
        case 'run': {
          if (!workflowId) throw new Error('workflowId required for workflow.run');
          if (!engine) return { success: false, error: 'Workflow engine not initialized', duration: Date.now() - start };
          const result = await engine.runWorkflow(workflowId, wfParams);
          return { success: true, data: result, duration: Date.now() - start };
        }
        case 'status': {
          if (!workflowId) throw new Error('workflowId required for workflow.status');
          const session = engine?.sessions?.get?.(workflowId);
          if (!session) return { success: false, error: `Workflow ${workflowId} not found`, duration: Date.now() - start };
          return { success: true, data: { id: workflowId, status: session.status, phase: session.phase, duration: session.duration }, duration: Date.now() - start };
        }
        case 'stop': {
          if (!workflowId) throw new Error('workflowId required for workflow.stop');
          if (engine?.stopWorkflow) {
            engine.stopWorkflow(workflowId);
            return { success: true, data: { id: workflowId, message: 'Stopped' }, duration: Date.now() - start };
          }
          return { success: false, error: 'stopWorkflow not implemented', duration: Date.now() - start };
        }
        case 'list': {
          const workflows = engine?.listWorkflows?.() || [];
          return { success: true, data: { workflows, count: workflows.length }, duration: Date.now() - start };
        }
        case 'get-result': {
          if (!workflowId) throw new Error('workflowId required');
          const result = engine?.getResult?.(workflowId);
          return { success: true, data: result || null, duration: Date.now() - start };
        }
        default:
          throw new Error(`Unknown workflow action: ${action}`);
      }
    } catch (e: any) {
      return { success: false, error: e.message, duration: Date.now() - start };
    }
  },
};
