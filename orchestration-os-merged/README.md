# Zo Orchestration OS

**Sovereign Polyglot AI Operating System — v3.0**

## What It Does

```
ONE PROMPT → Full App Built, Tested, Packaged
```

Send a prompt → Zo builds the code, runs tests, and packages it.

## Quick Start

```bash
cd /home/workspace/orchestration-os-merged
npm install
npm run build
npm start
```

## API

```bash
# Build an app
curl -X POST http://localhost:3000/api/build \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Flask API with /hello endpoint"}'

# Check status
curl http://localhost:3000/api/build/:id

# List artifacts
curl http://localhost:3000/api/build/:id/artifacts
```

## Current Capabilities

| Component | Status | Speed |
|-----------|--------|-------|
| Groq LLM (llama-3.3-70b) | ✅ Working | ~400ms |
| Python Runtime | ✅ Working | <1s |
| Bash Runtime | ✅ Working | <1s |
| Node.js Runtime | ✅ Working | <1s |
| Planner Agent | ✅ Working | ~400ms |
| Coder Agent | ✅ Working | ~1-5s |
| Tester Agent | ✅ Working | <1s |

## Supported App Types

- ✅ Python scripts
- ✅ Python APIs (Flask, FastAPI)
- ✅ Node.js APIs
- ✅ Bash scripts
- 🚧 Fullstack (React + Backend) — coming soon
- 🚧 Desktop (Electron/Tauri) — coming soon
- 🚧 Mobile (React Native) — coming soon

## Architecture

```
User Prompt
    ↓
[L8: Intelligence Routing] → local-free → cloud-free → paid-explicit
    ↓
[L6: Orchestrator] → Route to appropriate agents
    ↓
[L2: Agents] → Planner → Coder → Tester → Docs
    ↓
[L1: Runtimes] → Python · Bash · Node.js
    ↓
[L3: Tools] → fs.* · run.* · llm.*
    ↓
Output: Code + Tests + Artifacts
```

## Environment Variables

```bash
GROQ_API_KEY=gsk_xxx          # Free tier at console.groq.com
OLLAMA_HOST=http://localhost:11434  # Local Ollama
GEMINI_API_KEY=xxx             # Optional - for Gemini Flash
OPENAI_API_KEY=xxx             # Optional - for GPT
```

## Blueprint

See [blueprint.md](blueprint.md) for full architecture.

## Progress

See [PROGRESS.md](PROGRESS.md) for detailed status.

---

**Version:** 3.0  
**Status:** MVP Working  
**Next:** Ollama GPU tunnel, Fullstack workflow, Dashboard UI
