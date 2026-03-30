// Zo Orchestration OS — Comprehensive TypeScript Types
// Phases 1-17 Complete Type System

// ============================================================
// CORE SESSION & BUILD TYPES
// ============================================================

export interface Session {
  id: string;
  prompt: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  result?: BuildResult;
  error?: string;
  createdAt: number;
  updatedAt?: number;
  duration?: number;
  phase?: Phase;
  phases?: PhaseResult[];
}

export interface BuildResult {
  files: FileOutput[];
  plan: string;
  runtime: string;
  tests?: TestResult[];
  docs?: DocOutput[];
  metrics?: BuildMetrics;
}

export interface FileOutput {
  path: string;
  content: string;
  language?: string;
  type?: 'frontend' | 'backend' | 'config' | 'test' | 'docs';
}

export interface DocOutput {
  path: string;
  content: string;
  format: 'md' | 'html' | 'pdf';
}

export interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  output?: string;
}

export interface BuildMetrics {
  filesGenerated: number;
  linesOfCode: number;
  buildDuration: number;
  testPassRate: number;
  tokenUsage?: TokenUsage;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
}

// ============================================================
// PHASE TYPES
// ============================================================

export type Phase = 
  | 'planning' 
  | 'architect' 
  | 'coding' 
  | 'testing' 
  | 'packaging'
  | 'documentation'
  | 'deployment'
  | 'complete'
  | 'failed';

export interface PhaseResult {
  phase: Phase;
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
  artifacts?: string[];
}

// ============================================================
// LAYER 8 — MULTI-AI ROUTING & FEDERATION
// ============================================================

export type LLMTier = 'local-free' | 'cloud-free' | 'paid-explicit-only';
export type LLMRoutingStrategy = 'consensus' | 'champion-challenger' | 'specialist-routing' | 'sequential';

export interface LLMProvider {
  id: string;
  name: string;
  tier: LLMTier;
  defaultModel: string;
  supportedModels: string[];
  baseUrl: string;
  apiKey?: string;
  requiresApproval: boolean;
  maxConcurrency: number;
  latencyMs?: number;
  successRate?: number;
}

export interface LLMRoutingPolicy {
  global: LLMTier;
  perAgent?: Record<string, LLMTier>;
  perWorkflow?: Record<string, LLMTier>;
  federation?: {
    enabled: boolean;
    strategy: LLMRoutingStrategy;
    maxParallel: number;
  };
}

export interface LLMFederationRequest {
  prompt: string;
  systemPrompt?: string;
  tiers: LLMTier[];
  strategy: LLMRoutingStrategy;
  agents?: string[];
  maxParallel?: number;
}

export interface LLMFederationResult {
  results: LLMResult[];
  bestResult: LLMResult;
  consensus?: string;
  evaluation?: string;
}

export interface LLMResult {
  text: string;
  provider: string;
  model: string;
  duration: number;
  tokens?: number;
  cost?: number;
  latencyMs: number;
  error?: string;
  success?: boolean;
}

// ============================================================
// AGENT TYPES (LAYER 2)
// ============================================================

export type AgentRole = 
  | 'architect' 
  | 'coder' 
  | 'tester' 
  | 'docs' 
  | 'devops' 
  | 'security'
  | 'orchestrator'
  | 'multimodal';

export type AgentStatus = 'idle' | 'thinking' | 'working' | 'waiting' | 'error';

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  capabilities: string[];
  tools: string[];
  currentTask?: Task;
  memory: AgentMemory;
  metrics: AgentMetrics;
}

export interface AgentMemory {
  shortTerm: Record<string, unknown>;
  patterns: Pattern[];
  learnedHeuristics: string[];
}

export interface AgentMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  avgDuration: number;
  lastActive?: number;
  toolUsage: Record<string, number>;
}

export interface Task {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  assignedAgent?: string;
  result?: unknown;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

export interface AgentContext {
  session: Session;
  llm: LLMFederatedClient;
  runtime: Runtime;
  tools: ToolRegistry;
  memory: MemoryFabric;
  config: OrchestratorConfig;
}

export interface LLMFederatedClient {
  (prompt: string, options?: LLMOptions): Promise<LLMResult>;
  federation: (request: LLMFederationRequest) => Promise<LLMFederationResult>;
  selectProvider: (tier: LLMTier, context?: string) => Promise<LLMProvider>;
}

export interface LLMOptions {
  system?: string;
  model?: string;
  provider?: string;
  temperature?: number;
  maxTokens?: number;
  tier?: LLMTier;
}

// ============================================================
// TOOL TYPES (LAYER 3)
// ============================================================

export type ToolCategory = 'filesystem' | 'execution' | 'http' | 'llm' | 'multimodal' | 'db' | 'workflow' | 'orchestrator';

export interface Tool {
  name: string;
  category: ToolCategory;
  description: string;
  capabilities: string[];
  invoke: (params: ToolParams) => Promise<ToolResult>;
  metrics: ToolMetrics;
}

export interface ToolParams {
  [key: string]: unknown;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
}

export interface ToolMetrics {
  invocations: number;
  successes: number;
  failures: number;
  avgDuration: number;
  lastUsed?: number;
}

export interface ToolRegistry {
  register: (tool: Tool) => void;
  get: (name: string) => Tool | undefined;
  list: (category?: ToolCategory) => Tool[];
  invoke: (name: string, params: ToolParams) => Promise<ToolResult>;
}

// ============================================================
// RUNTIME TYPES (LAYER 1)
// ============================================================

export type RuntimeType = 'bash' | 'python' | 'node' | 'deno' | 'bun' | 'go' | 'rust' | 'ruby' | 'java';

export interface Runtime {
  name: RuntimeType;
  version: string;
  exec: (code: string, options?: RuntimeOptions) => Promise<ExecResult>;
  available: boolean;
}

export interface RuntimeOptions {
  timeout?: number;
  cwd?: string;
  env?: Record<string, string>;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

// ============================================================
// WORKFLOW TYPES (LAYER 4)
// ============================================================

export type WorkflowStatus = 'idle' | 'running' | 'paused' | 'complete' | 'failed';
export type WorkflowStepStatus = 'pending' | 'running' | 'complete' | 'failed' | 'skipped';

export interface Workflow {
  id: string;
  name: string;
  description: string;
  version: string;
  status: WorkflowStatus;
  steps: WorkflowStep[];
  config: WorkflowConfig;
  metrics?: WorkflowMetrics;
  createdAt: number;
  updatedAt?: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  action: string;
  agent?: string;
  tools?: string[];
  params?: Record<string, unknown>;
  status: WorkflowStepStatus;
  result?: unknown;
  error?: string;
  duration?: number;
  retryCount?: number;
  dependencies?: string[];
}

export interface WorkflowConfig {
  parallel: boolean;
  timeout?: number;
  retryPolicy?: RetryPolicy;
  rollbackOnFailure?: boolean;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffMs: number;
  exponentialBackoff: boolean;
}

export interface WorkflowMetrics {
  totalRuns: number;
  successRate: number;
  avgDuration: number;
  avgStepsCompleted: number;
}

// ============================================================
// INTELLIGENCE CORE — BRAINS + MEMORY FABRIC (LAYER 6)
// ============================================================

export interface Brain {
  id: string;
  type: 'primary' | 'backup';
  status: 'active' | 'standby' | 'error';
  roles: BrainRole[];
  metrics: BrainMetrics;
  lastSync?: number;
}

export type BrainRole = 
  | 'global-task-routing'
  | 'llm-routing'
  | 'agent-coordination'
  | 'memory-orchestration'
  | 'self-repair'
  | 'blueprint-evolution'
  | 'shadow-eval'
  | 'hot-standby'
  | 'failover';

export interface BrainMetrics {
  decisionsMade: number;
  decisionsCorrect: number;
  avgDecisionTime: number;
  failoverCount: number;
  lastDecision?: number;
}

export interface BackupBrain extends Brain {
  syncMode: 'event-log' | 'state-snapshots' | 'metrics-stream';
  primaryId: string;
}

export interface FailoverPolicy {
  triggers: FailoverTrigger[];
  actions: FailoverAction[];
  autoPromote: boolean;
}

export type FailoverTrigger = 'healthcheck-fail' | 'latency-spike' | 'panic-error' | 'memory-exhaustion';
export type FailoverAction = 'promote-backup' | 'spawn-new-backup' | 'restart-brain' | 'alert-operator';

export interface MemoryLayer {
  id: string;
  name: string;
  description: string;
  backend: string;
  ttl?: number;
  capacity?: number;
  read: (key: string) => Promise<unknown>;
  write: (key: string, value: unknown, ttl?: number) => Promise<void>;
  delete: (key: string) => Promise<void>;
  list: (pattern?: string) => Promise<string[]>;
}

export interface MemoryFabric {
  shortTerm: MemoryLayer;
  midTerm: MemoryLayer;
  longTerm: MemoryLayer;
  read: (layer: string, key: string) => Promise<unknown>;
  write: (layer: string, key: string, value: unknown, ttl?: number) => Promise<void>;
  checkpoint: (workflowId: string) => Promise<void>;
  resume: (workflowId: string) => Promise<unknown>;
}

// ============================================================
// ORCHESTRATOR TYPES (LAYER 6)
// ============================================================

export interface OrchestratorConfig {
  sessionTimeout: number;
  maxParallelAgents: number;
  toolTimeout: number;
  llmTimeout: number;
  routingPolicy: LLMRoutingPolicy;
  failoverPolicy: FailoverPolicy;
  selfRepairEnabled: boolean;
  blueprintHotReload: boolean;
}

export interface OrchestratorState {
  status: 'initializing' | 'ready' | 'degraded' | 'error';
  activeSessions: number;
  activeAgents: number;
  queueDepth: number;
  lastHealthCheck?: number;
}

export interface OrchestratorHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: Record<string, ComponentHealth>;
  uptime: number;
}

export interface ComponentHealth {
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  errorRate?: number;
  lastCheck?: number;
}

// ============================================================
// HOOKS TYPES (LAYER 6)
// ============================================================

export type HookType = 'http' | 'mq' | 'fs' | 'cron' | 'cli' | 'git';

export interface Hook {
  id: string;
  name: string;
  type: HookType;
  enabled: boolean;
  config: HookConfig;
  lastTriggered?: number;
  triggerCount: number;
  errorCount: number;
}

export interface HookConfig {
  event?: string;
  url?: string;
  path?: string;
  schedule?: string;
  command?: string;
  filter?: string;
}

// ============================================================
// OBSERVABILITY TYPES (LAYER 6)
// ============================================================

export interface MetricsStore {
  llm: LLMetrics;
  agents: AgentMetricsStore;
  workflows: WorkflowMetricsStore;
  tools: ToolMetricsStore;
  system: SystemMetrics;
}

export interface LLMetrics {
  requests: number;
  tokensUsed: number;
  cost: number;
  byProvider: Record<string, ProviderMetrics>;
  latencyHistogram: number[];
}

export interface ProviderMetrics {
  requests: number;
  tokens: number;
  avgLatency: number;
  successRate: number;
  cost: number;
}

export interface AgentMetricsStore {
  byAgent: Record<string, AgentMetrics>;
}

export interface WorkflowMetricsStore {
  byWorkflow: Record<string, WorkflowMetrics>;
}

export interface ToolMetricsStore {
  byTool: Record<string, ToolMetrics>;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkLatency: number;
  uptime: number;
}

// ============================================================
// BLUEPRINT TYPES (LAYER 6)
// ============================================================

export interface Blueprint {
  version: string;
  name: string;
  description: string;
  layers: BlueprintLayer[];
  grid: BlueprintGrid;
  pipelines: BlueprintPipelines;
  active: boolean;
  createdAt: number;
  updatedAt?: number;
}

export interface BlueprintLayer {
  id: string;
  name: string;
  components: string[];
  status: 'active' | 'inactive' | 'planned';
}

export interface BlueprintGrid {
  columns: number;
  rows: number;
  regions: GridRegion[];
}

export interface GridRegion {
  id: string;
  grid: string;
  label: string;
}

export interface BlueprintPipelines {
  boot: string[];
  task: string[];
  llm: string[];
  onePromptApp: string[];
}

export interface BlueprintEvolution {
  currentVersion: string;
  targetVersion: string;
  changes: EvolutionChange[];
  status: 'stable' | 'evolving' | 'rollback';
}

export interface EvolutionChange {
  layer: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  timestamp: number;
}

// ============================================================
// SELF-REPAIR TYPES (PHASE 11)
// ============================================================

export interface SelfRepairSystem {
  enabled: boolean;
  modes: SelfRepairMode[];
  recentRepairs: RepairResult[];
}

export type SelfRepairMode = 'automatic' | 'advisory' | 'disabled';

export interface RepairResult {
  id: string;
  type: string;
  trigger: string;
  action: string;
  success: boolean;
  duration: number;
  timestamp: number;
}

// ============================================================
// PATTERN STORE TYPES (PHASE 4)
// ============================================================

export interface PatternStore {
  patterns: Pattern[];
  add: (pattern: Pattern) => void;
  find: (query: PatternQuery) => Pattern[];
  evolve: (id: string, feedback: PatternFeedback) => void;
}

export interface Pattern {
  id: string;
  name: string;
  category: string;
  description: string;
  workflow: Workflow;
  successRate: number;
  usageCount: number;
  lastUsed?: number;
  tags: string[];
}

export interface PatternQuery {
  category?: string;
  tags?: string[];
  minSuccessRate?: number;
  taskType?: string;
}

export interface PatternFeedback {
  patternId: string;
  success: boolean;
  delta?: string;
  notes?: string;
}

// ============================================================
// DEPLOYMENT TYPES (LAYER 7)
// ============================================================

export type DeploymentTarget = 'windows-exe' | 'android-apk' | 'web-spa' | 'linux-appimage' | 'macos-dmg';

export interface DeploymentConfig {
  target: DeploymentTarget;
  buildOptions: Record<string, unknown>;
  signing?: {
    enabled: boolean;
    keyPath?: string;
  };
  postBuild?: string[];
}

export interface DeploymentResult {
  success: boolean;
  artifact: string;
  size: number;
  duration: number;
  checksums: Record<string, string>;
}
