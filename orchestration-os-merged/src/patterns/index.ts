// Phase 4 — Pattern Store (in-memory, no persistence yet)
export interface Pattern {
  id: string;
  name: string;
  description: string;
  type: string;
  payload: Record<string, unknown> | null;
  score: number;
  tags: string[];
  createdAt: number;
  lastUsed?: number;
  usageCount: number;
}

const patterns: Pattern[] = [];

export function listPatterns(type?: string): Pattern[] {
  if (type) return patterns.filter(p => p.type === type);
  return [...patterns];
}

export function storePattern(data: {
  name: string;
  description: string;
  type: string;
  payload?: Record<string, unknown> | null;
  score?: number;
  tags?: string[];
}): Pattern {
  const pattern: Pattern = {
    id: `pattern_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: data.name,
    description: data.description,
    type: data.type,
    payload: data.payload ?? null,
    score: data.score ?? 0.5,
    tags: data.tags ?? [],
    createdAt: Date.now(),
    usageCount: 0,
  };
  patterns.push(pattern);
  return pattern;
}

export function getPattern(id: string): Pattern | undefined {
  return patterns.find(p => p.id === id);
}

export function deletePattern(id: string): boolean {
  const idx = patterns.findIndex(p => p.id === id);
  if (idx === -1) return false;
  patterns.splice(idx, 1);
  return true;
}

export function usePattern(id: string): Pattern | undefined {
  const p = patterns.find(p => p.id === id);
  if (p) {
    p.usageCount++;
    p.lastUsed = Date.now();
  }
  return p;
}
