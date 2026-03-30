# Zo Orchestration OS — Master Blueprint

## Vision

Zo Orchestration OS is a **sovereign, polyglot, multimodal, containerized AI Operating System** that:
- Builds, tests, and ships fullstack applications
- Packages them into Windows EXE and Android APK binaries
- Evolves and self-repairs its own architecture
- Exposes HTTP, MQ, FS, cron, and CLI hooks for external control

---

## Layer Architecture (L0–L7)

### L0 — Foundation
**Responsibility:** Core infrastructure primitives.

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Networking | Docker network, nginx | Inter-container communication, ingress |
| Storage | Docker volumes, S3-compatible | Persistent state, artifacts |
| Secrets | Vault, Docker secrets | API keys, credentials |
| Observability | Prometheus, Loki, Grafana | Metrics, logs, tracing |
| Scheduling | Docker compose, custom controller | Workflow orchestration |
| Service Mesh | Traefik, Envoy | Load balancing, circuit breakers |

### L1 — Runtimes
**Responsibility:** Language-specific execution environments.

| Runtime | Image | Package Manager | Linting | REPL/Terminal |
|---------|-------|----------------|---------|---------------|
| Python | `python:3.12-slim` | pip, poetry, conda | black, flake8, ruff | ipython, jupyter |
| Node.js | `node:22-alpine` | npm, pnpm, yarn | eslint, prettier | ts-node |
| Bash | `bash:5.2-alpine` | apk (coreutils) | shellcheck | bash |
| Rust | `rust:1.77-slim` | cargo | clippy, rustfmt | rust REPL |
| Go | `golang:1.22-alpine` | go mod | golangci-lint | go repl |
| Lua | `lua:5.4-slim` | luarocks | luacheck | lua interpreter |
| Deno | `deno:2.0` | deno install | deno lint | deno repl |
| Bun | `oven/bun:1.1` | bun | bun --lint | bun repl |
| Ruby | `ruby:3.3-slim` | bundler | rubocop | irb |
| Elixir | `elixir:1.17-erlang27` | mix | credo | iex |
| Julia | `julia:1.11` | Pkg | JuliaFormatter.jl | julia REPL |
| PowerShell | `mcr.microsoft.com/powershell:lts` | PSGallery | PSScriptAnalyzer | pwsh |
| Java | `eclipse-temurin:21-jdk` | maven, gradle | spotbugs | jshell |
| C#/.NET | `mcr.microsoft.com/dotnet/sdk:8.0` | dotnet | roslyn analyzers | dotnet script |

### L2 — Agents

| Agent | Language | Core Capability |
|-------|----------|-----------------|
| **Coder** | Per-runtime | Write, refactor, optimize code |
| **Architect** | Python/Node | Design systems, APIs, schemas |
| **Tester** | Per-runtime | Generate and run test suites |
| **Docs** | Markdown/LaTeX | Generate README, API docs |
| **Multimodal** | Python | Orchestrate image/audio/video processing |
| **Orchestrator-Helper** | Python | Introspection, self-repair, blueprint evolution |
| **DevOps** | Bash/Python | CI/CD pipelines, Dockerfiles, infra-as-code |
| **Security** | Python | SAST, dependency auditing, secrets scanning |

### L3 — Tools

#### Filesystem Tools
- `fs.read(path)` — Read file contents
- `fs.write(path, content)` — Write file contents
- `fs.mkdir(path)` — Create directory
- `fs.exists(path)` — Check existence
- `fs.list(path)` — List directory contents
- `fs.delete(path)` — Delete file/directory

#### Execution Tools
- `run.command(container, cmd)` — Run shell command in container
- `run.tests(container)` — Execute test suite
- `run.interactive(container)` — Start interactive REPL session

#### HTTP Tools
- `http.request(method, url, headers, body)` — Make HTTP call
- `http.upload(url, file, metadata)` — Upload file via multipart

#### LLM Tools
- `llm.complete(model, prompt, system)` — Text completion
- `llm.chat(model, messages)` — Chat completion
- `llm.plan(model, goal)` — Task decomposition
- `llm.vision(model, image, prompt)` — Image understanding
- `llm.embed(model, text)` — Text embeddings

#### Multimodal Tools
- `image.generate(prompt, model)` — Generate image
- `image.edit(source, prompt)` — Edit existing image
- `audio.transcribe(audio_file)` — Speech-to-text
- `audio.speak(text, voice)` — Text-to-speech
- `video.extract_frames(video, fps)` — Extract frames

#### Database Tools
- `db.query(sql)` — Execute SQL query
- `db.migrate(schema)` — Run migrations
- `db.backup(path)` — Backup database

#### Workflow Tools
- `workflow.define(workflow_id, steps)` — Create/modify workflow
- `workflow.run(workflow_id, inputs)` — Execute workflow
- `workflow.status(workflow_id)` — Get workflow status

#### Orchestrator Tools
- `orchestrator.inspect()` — Get full system state
- `orchestrator.patch(patch)` — Apply configuration changes
- `orchestrator.health()` — Health check all components

### L4 — Workflows

#### wf-video-understanding
```
extract-audio (bash + ffmpeg)
  → transcribe-audio (python + audio.transcribe)
    → chunk-and-embed (python + embed.text)
      → answer-question (python + llm.complete)
```

#### wf-build-fullstack-app
```
plan-architecture (python + agent-architect + llm.plan)
  → scaffold-frontend (node + agent-coder + run.command)
    → scaffold-backend (python + agent-coder + run.command)
      → generate-docker-compose (bash + agent-coder + fs.write)
        → run-tests (python + run.tests)
          → package-and-release (python + docker build + fs.write)
```

#### wf-release-windows-desktop-app
```
build-backend (python)
  → build-frontend (node)
    → bundle-desktop-shell (node + electron-builder/tauri)
      → collect-artifacts (bash)
        → sign-and-package (python + osslsigncode)
```

#### wf-release-android-app
```
build-android (node + gradle/react-native)
  → sign-apk (bash + apksigner)
    → align-apk (bash + zipalign)
      → publish-to-store (http.request + Google Play API)
```

#### wf-self-diagnose-and-repair
```
orchestrator.health()
  → parse-metrics (python)
    → identify-failures (python + llm.plan)
      → generate-patch (python + agent-orch-helper)
        → apply-patch (orchestrator.patch)
          → verify-fix (run.tests)
```

### L5 — Apps

| App | Frontend | Backend | Targets |
|-----|----------|---------|---------|
| **Zo Orchestration Dashboard** | React + Vite | Python + FastAPI | Web (PWA), Windows (Electron) |
| **Multimodal AI Lab** | React Native | Python + FastAPI | Android (APK), Web |
| **API Gateway Manager** | React + Swagger UI | Python + FastAPI | Web, Windows |
| **Log Analyzer** | React + Recharts | Python + Pandas | Web, Windows |
| **Workflow Builder** | React + React Flow | Python + FastAPI | Web |
| **Container Manager** | React + Docker API | Python + FastAPI | Web (Docker socket) |

### L6 — Orchestrator

#### Core Responsibilities
1. **Blueprint Loading** — Parse and validate `blueprint.yaml`
2. **State Tracking** — Inventory of all runtimes, agents, tools, workflows, apps
3. **Task Routing** — Route incoming tasks to appropriate agent/tool chains
4. **Hook Management** — HTTP callbacks, message queues, filesystem watches, cron jobs, CLI
5. **Health Monitoring** — Continuous health checks, log aggregation, metric collection
6. **Self-Repair** — Detect failures, generate patches, apply fixes, verify
7. **Blueprint Evolution** — Learn from past runs, suggest improvements to blueprint

#### API Endpoints
```
POST /tasks              — Submit a new task
GET  /tasks/:id          — Get task status
POST /workflows/:id/start — Start a workflow
GET  /workflows/:id/status — Get workflow status
POST /apps/:id/release   — Build and release an app
POST /blueprint/update   — Update blueprint
GET  /health             — System health
GET  /metrics            — Prometheus metrics
WS   /logs              — Real-time log stream
```

### L7 — Deployment Targets

| Target | Formats | Packagers |
|--------|---------|-----------|
| **Windows Desktop** | EXE, MSIX | electron-builder, tauri, NSIS, .NET MAUI |
| **Android** | APK, AAB | Gradle (Android Studio), React Native, Flutter |
| **Web** | SPA, PWA | Vite, Next.js, Nuxt |
| **Linux Desktop** | AppImage, DEB, RPM | electron-builder, Flatpak |
| **macOS** | DMG, APP | electron-builder, Xcode |

---

## Execution Phases

### Phase 1: Foundation (Week 1–2)
- [ ] Docker compose networking with Traefik
- [ ] Volume management for persistent storage
- [ ] Basic secrets injection via environment
- [ ] Prometheus + Grafana stack
- [ ] Loki for log aggregation
- [ ] Health check endpoints on all containers

**Deliverable:** Running container orchestrator with observability

### Phase 2: Core Runtimes (Week 2–3)
- [ ] Python container with pip, black, flake8, ipython
- [ ] Node.js container with npm, eslint, ts-node
- [ ] Bash container with coreutils, jq, shellcheck
- [ ] Runtime health checks
- [ ] Package manager caching (pip wheel, npm cache)

**Deliverable:** All 14 runtimes operational and health-checked

### Phase 3: LLM Integration (Week 3–4)
- [ ] Ollama integration (local models: qwen2.5-coder:3b, gemma3:4b)
- [ ] OpenRouter fallback chain
- [ ] Gemini API integration
- [ ] Per-runtime LLM tool bindings
- [ ] Rate limiting and quota management
- [ ] Token usage tracking

**Deliverable:** All agents can call LLMs with automatic fallback

### Phase 4: Core Agents (Week 4–6)
- [ ] Coder Agent per runtime (template prompts)
- [ ] Architect Agent (system design, API specs)
- [ ] Tester Agent (test generation + execution)
- [ ] Docs Agent (README, API docs generation)
- [ ] Agent orchestration via supervisor pattern

**Deliverable:** Full coding workflow: plan → code → test → docs

### Phase 5: Core Tools (Week 6–8)
- [ ] Filesystem tools with workspace isolation
- [ ] Run command with timeout and resource limits
- [ ] HTTP request tool with retry logic
- [ ] Database tools (SQLite first, then Postgres)
- [ ] Workflow definition and execution engine

**Deliverable:** All L3 tools operational with health checks

### Phase 6: Workflows (Week 8–10)
- [ ] wf-video-understanding
- [ ] wf-build-fullstack-app
- [ ] wf-release-windows-desktop-app
- [ ] wf-release-android-app
- [ ] wf-self-diagnose-and-repair

**Deliverable:** End-to-end workflows executing successfully

### Phase 7: Dashboard UI (Week 10–12)
- [ ] React + Vite frontend
- [ ] WebSocket log streaming
- [ ] Workflow visual builder
- [ ] Real-time metrics dashboard
- [ ] Blueprint editor with validation

**Deliverable:** Usable web interface for full system control

### Phase 8: Desktop Packaging (Week 12–14)
- [ ] Electron wrapper for Windows
- [ ] Tauri alternative for smaller bundle
- [ ] Code signing (Windows Authenticode)
- [ ] Auto-update mechanism

**Deliverable:** Windows .exe distribution

### Phase 9: Mobile Packaging (Week 14–16)
- [ ] React Native wrapper for Android
- [ ] Gradle build configuration
- [ ] APK signing (keystore management)
- [ ] Google Play upload integration

**Deliverable:** Android APK distribution

### Phase 10: Self-Evolution (Week 16+)
- [ ] Blueprint version control
- [ ] Learned optimizations from past runs
- [ ] Automatic prompt/template improvement
- [ ] New runtime/agent auto-discovery
- [ ] Anomaly detection in workflows

**Deliverable:** Self-improving orchestrator

---

## Failure Modes & Recovery

| Failure | Detection | Recovery |
|---------|-----------|----------|
| LLM provider down | HTTP 503/504 | Fallback to next provider |
| Container OOM | cgroup memory limit | Restart with higher limit |
| Build timeout | Task exceeds time budget | Kill task, notify user |
| Disk full | Volume space check | Alert + cleanup old artifacts |
| Network partition | Reachability check | Queue tasks, retry on reconnect |
| Bad code gen | Test failure | Re-run with stricter prompt |
| Workflow deadlock | Timeout + cycle detection | Kill workflow, rollback state |
| Secrets leak | Audit log scan | Rotate keys, revoke access |

---

## Hooks Specification

### HTTP Hooks
```yaml
hooks:
  http:
    - name: "CI trigger"
      url: "${CI_WEBHOOK_URL}"
      events: ["workflow.complete", "release.ready"]
      secret: "${WEBHOOK_SECRET}"
```

### Message Queue Hooks
```yaml
hooks:
  mq:
    - name: "Task queue"
      broker: "amqp://localhost:5672"
      queue: "zo-tasks"
      events: ["task.submitted", "task.complete"]
```

### Filesystem Hooks
```yaml
hooks:
  fs:
    - name: "Blueprint hot-reload"
      path: "/workspace/blueprint.yaml"
      events: ["file.changed"]
      action: "reload-blueprint"
```

### Cron Hooks
```yaml
hooks:
  cron:
    - name: "Daily health check"
      schedule: "0 2 * * *"
      action: "wf-self-diagnose-and-repair"
    - name: "Weekly cleanup"
      schedule: "0 3 * * 0"
      action: "cleanup-old-artifacts"
```

### CLI Hooks
```yaml
hooks:
  cli:
    - name: "Git commit hook"
      command: "git commit"
      pre_action: "run-tests"
      post_action: "push-to-registry"
```

---

## Dependencies

### Build Dependencies
- Docker 24+
- Docker Compose v2
- Node.js 22+ (for dashboard)
- Python 3.12+ (for orchestrator core)
- Make, jq, yq (for build scripts)

### Runtime Dependencies
- Traefik (reverse proxy)
- Prometheus (metrics)
- Loki (logs)
- Grafana (visualization)
- PostgreSQL (workflow state)
- Redis (caching, rate limiting)

### External APIs
- OpenRouter (LLM aggregation)
- Google Gemini API
- OpenAI API (optional)
- Anthropic API (optional)

---

## Blueprint Schema

```yaml
version: "1.0"
orchestrator:
  name: "zo-orchestration-os"
  version: "1.0.0"

layers:
  L0:
    networking: true
    storage: true
    secrets: true
    observability: true
  
  L1:
    runtimes:
      - python:3.12-slim
      - node:22-alpine
      - bash:5.2-alpine
      # ... etc
  
  L2:
    agents:
      - coder
      - architect
      - tester
      - docs
  
  L3:
    tools:
      - fs.read
      - fs.write
      - run.command
      # ... etc

workflows:
  - id: "wf-build-fullstack-app"
    steps: [...]
  
  - id: "wf-self-diagnose-and-repair"
    steps: [...]

apps:
  - id: "dashboard"
    frontend: "react+vite"
    backend: "python+fastapi"
    targets: ["web", "windows"]

hooks:
  http: [...]
  cron: [...]
  fs: [...]
  cli: [...]

deployment:
  targets:
    - windows-desktop
    - android
    - web
```

---

## Extension Points

1. **New Runtime** — Add to L1 array + create `runtime-<name>/Dockerfile`
2. **New Agent** — Create `agents/agent-<name>/` with `run()` function
3. **New Tool** — Implement `Tool` interface, register in L3
4. **New Workflow** — Define in `workflows/` with YAML schema
5. **New App** — Create `apps/<app-name>/` with frontend + backend
6. **New Deployment Target** — Add packager + signing configuration

---

## Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| Python runtime | ✅ Working | pip, black, flake8, ipython |
| Bash runtime | ✅ Working | coreutils, jq |
| Node.js runtime | ✅ Working | npm, eslint |
| LLM client | ✅ Working | Ollama, OpenRouter, Gemini |
| Coder Agent | ✅ Working | Simple code generation |
| Orchestrator | ✅ Working | Basic task routing |
| Self-repair | 🚧 Planned | Phase 10 |
| Dashboard UI | 🚧 Planned | Phase 7 |
| Windows packaging | 🚧 Planned | Phase 8 |
| Android packaging | 🚧 Planned | Phase 9 |
