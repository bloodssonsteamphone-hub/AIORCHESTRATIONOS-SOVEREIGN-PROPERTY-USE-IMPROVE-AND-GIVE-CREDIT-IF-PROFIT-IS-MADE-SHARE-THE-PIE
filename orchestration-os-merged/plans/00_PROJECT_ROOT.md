# ORCHESTRATION OS - MASTER PROJECT PLAN

## Vision
Build an **Internal Containerized AI Development Platform** where each Docker container is a complete development environment with:
- A specific scripting language runtime
- An AI agent wrapped around that language
- Terminal/REPL access
- Tooling and automation
- Inter-container communication for complex workflows

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATION LAYER                       │
│  (Zo Computer - coordinates all containers & workflows)     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │Python   │ │Node.js  │ │  Bash   │ │  Rust   │  ...       │
│  │Container│ │Container│ │Container│ │Container│            │
│  │─────────│ │─────────│ │─────────│ │─────────│            │
│  │Python   │ │Node.js  │ │Bash/    │ │  Rust   │            │
│  │Runtime  │ │Runtime  │ │Zsh      │ │Runtime  │            │
│  │Coder    │ │Coder    │ │Coder    │ │Coder    │            │
│  │Agent    │ │Agent    │ │Agent    │ │Agent    │            │
│  │Terminal  │ │Terminal  │ │Terminal  │ │Terminal  │            │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│                                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │Lua/     │ │  Ruby   │ │  Go     │ │  Java   │  ...       │
│  │Luau     │ │         │ │         │ │         │            │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
└─────────────────────────────────────────────────────────────┘
```

---

## Container Registry

| Language | Priority | Docker Image | Status | Notes |
|----------|----------|--------------|--------|-------|
| Python | P0 | python:3.12-slim | TODO | Fast, mature |
| Node.js | P0 | node:22-alpine | TODO | npm ecosystem |
| Bash | P0 | bash:5.2-alpine | TODO | Shell scripting |
| Rust | P1 | rust:1.77-slim | TODO | High performance |
| Go | P1 | golang:1.22-alpine | TODO | Concurrency |
| Lua/Luau | P1 | lua:5.4-slim | TODO | Fast scripting |
| Ruby | P2 | ruby:3.3-slim | TODO | Rails ecosystem |
| Java | P2 | eclipse-temurin:21 | TODO | Enterprise |
| C#/.NET | P2 | mcr.microsoft.com/dotnet:8.0 | TODO | Windows compat |
| PHP | P3 | php:8.3-cli-alpine | TODO | Legacy web |
| R | P3 | r-base:4.4 | TODO | Data science |
| Zig | P3 | zig:0.13 | TODO | Performance |
| Nim | P3 | nim:2.0 | TODO | Compiles to C |
| Crystal | P3 | crystal:1.12 | TODO | Ruby-like, fast |
| Deno | P1 | deno:2.0 | TODO | Node alternative |
| Bun | P1 | oven/bun:1.1 | TODO | Fast JS runtime |
| Swift | P2 | swift:6.0 | TODO | Apple ecosystem |
| Kotlin | P2 | eclipse-temurin:21-kotlin | TODO | JVM alternative |
| Scala | P3 | scala:3.4-scala3 | TODO | Functional JVM |
| Elixir | P2 | elixir:1.17-erlang27 | TODO | BEAM VM |
| Clojure | P3 | clojure:1.12 | TODO | Lisp on JVM |
| Haskell | P3 | haskell:9.10 | TODO | Pure functional |
| Prolog | P4 | swipl:9.2 | TODO | Logic programming |
| Julia | P2 | julia:1.11 | TODO | Scientific computing |
| Racket | P3 | racket:8.14 | TODO | Scheme dialect |
| OCaml | P3 | ocaml:5.3 | TODO | ML family |
| Perl | P4 | perl:5.40 | TODO | Text processing |
| Powershell | P3 | mcr.microsoft.com/powershell:lts | TODO | Windows admin |

---

## Implementation Phases

### Phase 1: Foundation (P0 Languages)
- [ ] Python container (python:3.12-slim)
- [ ] Node.js container (node:22-alpine)  
- [ ] Bash container (bash:5.2-alpine)
- [ ] Base orchestration layer
- [ ] Container communication (Docker socket or TCP)

### Phase 2: High-Priority Languages (P1)
- [ ] Rust container
- [ ] Go container
- [ ] Lua/Luau container
- [ ] Deno container
- [ ] Bun container

### Phase 3: Secondary Languages (P2)
- [ ] Ruby container
- [ ] Java container
- [ ] Swift container
- [ ] Kotlin container
- [ ] Elixir container
- [ ] Julia container

### Phase 4: Niche Languages (P3-P4)
- [ ] All remaining P3 languages
- [ ] P4 languages
- [ ] Research/proof-of-concept containers

---

## Tooling Per Container

Each container MUST have:
1. **Runtime** - Language interpreter/compiler
2. **Package Manager** - pip, npm, cargo, etc.
3. **AI Agent** - LLM wrapper for that language
4. **Terminal** - Interactive shell
5. **File Editor** - nano/vim/ledit
6. **Version Control** - git

Optional per language:
- REPL/Interactive console
- Language-specific formatters/linters
- Debugger

---

## Container Template Structure

```dockerfile
FROM <base-image>

# Install core tools
RUN apt-get update && apt-get install -y \
    git curl wget vim nano \
    && rm -rf /var/lib/apt/lists/*

# Install language-specific tools
RUN pip install --no-cache-dir \
    langchain openai anthropic \
    jupyter ipython black flake8

# Install AI wrapper
COPY langchain-agent.py /app/agent.py

WORKDIR /app
CMD ["python", "/app/agent.py"]
```

---

## Communication Protocols

### Container → Orchestrator
- REST API calls to Zo
- File system shared volumes
- Docker socket for container management

### Container → Container
- Shared workspace volume
- Message queue (Redis/nats) for async
- gRPC for synchronous calls

### Container → External
- NATS/Redis pubsub for events
- REST API for LLM calls

---

## LLM Integration Options Per Container

1. **Ollama** (local) - Best for large models, privacy
2. **LM Studio** - Desktop GPU acceleration
3. **Google AI Studio** (Gemini) - Cloud, high rate limits
4. **OpenAI** - GPT models
5. **OpenRouter** - Unified API, many providers
6. **Groq** - Fast inference
7. **Perplexity** - Real-time knowledge

---

## Progress Tracking

See `trackers/` directory for detailed status of each language.

---

## Quick Links

- [Plans](./plans/)
- [Docker Containers](./dockers/)
- [Script Templates](./scripts/)
- [Status Trackers](./trackers/)
