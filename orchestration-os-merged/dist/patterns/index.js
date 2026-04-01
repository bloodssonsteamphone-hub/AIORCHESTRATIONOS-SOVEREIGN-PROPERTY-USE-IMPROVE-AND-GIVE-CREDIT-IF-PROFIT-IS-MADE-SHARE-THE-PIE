const patterns = [];
export function listPatterns(type) {
    if (type)
        return patterns.filter(p => p.type === type);
    return [...patterns];
}
export function storePattern(data) {
    const pattern = {
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
export function getPattern(id) {
    return patterns.find(p => p.id === id);
}
export function deletePattern(id) {
    const idx = patterns.findIndex(p => p.id === id);
    if (idx === -1)
        return false;
    patterns.splice(idx, 1);
    return true;
}
export function usePattern(id) {
    const p = patterns.find(p => p.id === id);
    if (p) {
        p.usageCount++;
        p.lastUsed = Date.now();
    }
    return p;
}
