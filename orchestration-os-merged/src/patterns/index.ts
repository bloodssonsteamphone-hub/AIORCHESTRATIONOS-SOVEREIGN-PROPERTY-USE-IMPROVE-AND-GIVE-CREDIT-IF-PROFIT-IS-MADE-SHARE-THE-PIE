// Phase 12 — Pattern Store (Backup Brain Pattern Memory)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface Pattern {
  id: string;
  name: string;
  description: string;
  type: 'workflow' | 'agent' | 'tool' | 'routing' | 'repair' | 'evaluation';
  payload: unknown;
  score: number;
  uses: number;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

const PATTERN_DIR = '/tmp/zo-patterns';
const PATTERN_INDEX = join(PATTERN_DIR, 'index.json');

function ensureStore() {
  mkdirSync(PATTERN_DIR, { recursive: true });
  if (!existsSync(PATTERN_INDEX)) writeFileSync(PATTERN_INDEX, JSON.stringify([], null, 2));
}

function loadPatterns(): Pattern[] {
  ensureStore();
  try {
    return JSON.parse(readFileSync(PATTERN_INDEX, 'utf-8'));
  } catch { return []; }
}

function savePatterns(patterns: Pattern[]) {
  ensureStore();
  writeFileSync(PATTERN_INDEX, JSON.stringify(patterns, null, 2));
}

export function storePattern(pattern: Omit<Pattern, 'id' | 'uses' | 'createdAt' | 'updatedAt'>): Pattern {
  const patterns = loadPatterns();
  const existing = patterns.findIndex(p => p.name === pattern.name && p.type === pattern.type);

  const entry: Pattern = {
    ...pattern,
    id: existing >= 0 ? patterns[existing].id : `pat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    uses: existing >= 0 ? patterns[existing].uses : 0,
    createdAt: existing >= 0 ? patterns[existing].createdAt : Date.now(),
    updatedAt: Date.now(),
  };

  if (existing >= 0) patterns[existing] = entry;
  else patterns.push(entry);

  savePatterns(patterns);
  return entry;
}

export function retrievePattern(type: Pattern['type'], tags?: string[]): Pattern | undefined {
  const patterns = loadPatterns().filter(p => {
    if (p.type !== type) return false;
    if (tags && tags.length > 0) return tags.some(t => p.tags.includes(t));
    return true;
  });
  if (patterns.length === 0) return undefined;
  const best = patterns.sort((a, b) => b.score - a.score || b.uses - a.uses)[0];
  best.uses++;
  savePatterns(patterns);
  return best;
}

export function listPatterns(type?: Pattern['type']): Pattern[] {
  const patterns = loadPatterns();
  return type ? patterns.filter(p => p.type === type) : patterns;
}

export function deletePattern(id: string): boolean {
  const patterns = loadPatterns();
  const idx = patterns.findIndex(p => p.id === id);
  if (idx < 0) return false;
  patterns.splice(idx, 1);
  savePatterns(patterns);
  return true;
}

export function updatePatternScore(id: string, score: number) {
  const patterns = loadPatterns();
  const p = patterns.find(p => p.id === id);
  if (!p) return;
  p.score = score;
  p.updatedAt = Date.now();
  savePatterns(patterns);
}

export async function learnFromWorkflowResult(workflowId: string, success: boolean, durationMs: number, stepsCompleted: number): Promise<void> {
  storePattern({
    name: `wf-result:${workflowId}`,
    description: `Last result for workflow ${workflowId}: ${success ? 'success' : 'failure'}, ${durationMs}ms, ${stepsCompleted} steps`,
    type: 'workflow',
    payload: { workflowId, success, durationMs, stepsCompleted },
    score: success ? 1.0 : 0.0,
    tags: success ? ['success'] : ['failure'],
  });
}

export async function learnFromAgentDecision(agent: string, prompt: string, outcome: 'correct' | 'incorrect' | 'partial', latencyMs: number): Promise<void> {
  const score = outcome === 'correct' ? 1.0 : outcome === 'partial' ? 0.5 : 0.0;
  storePattern({
    name: `agent-decision:${agent}`,
    description: `Decision outcome for ${agent}: ${outcome} (${latencyMs}ms)`,
    type: 'agent',
    payload: { agent, outcome, latencyMs, promptSnippet: prompt.slice(0, 100) },
    score,
    tags: [agent, outcome],
  });
}
