# Node.js Container Plan

## Status: NOT STARTED

## Vision
Create a Docker container with:
- Node.js 22 LTS runtime
- TypeScript support
- All major AI SDKs pre-installed
- npm/pnpm/yarn package managers
- Interactive REPL
- AI Agent wrapper that can call LLMs
- File editing and terminal access
- Git version control

---

## Components Needed

### 1. Dockerfile
**Path:** `dockers/nodejs/Dockerfile`

```dockerfile
FROM node:22-alpine

# Install system tools
RUN apk add --no-cache \
    git curl wget vim nano jq \
    bash zsh fish

# Install Node tools globally
RUN npm install -g \
    typescript tsx \
    deno bun \
    pm2 forever \
    nodemon \
    prettier eslint

# Install AI SDKs globally
RUN npm install -g \
    openai @anthropic-ai/sdk \
    @google/generative-ai \
    langchain @langchain/core

# Install CLI tools
RUN npm install -g \
    httpie graphql-request \
    ts-node ts-node-dev

# Create app directory
WORKDIR /app

# Copy agent script
COPY agent.ts /app/agent.ts

# Default command - run agent
CMD ["node", "/app/agent.ts"]
```

### 2. AI Agent Script
**Path:** `scripts/nodejs/agent.ts`

Features:
- [ ] Accept natural language prompts
- [ ] Write TypeScript/JavaScript code
- [ ] Execute code via tsx
- [ ] Return results/errors
- [ ] Use Ollama when available
- [ ] Fallback to cloud APIs
- [ ] Support file operations
- [ ] Support command execution
- [ ] npm script running

### 3. Terminal/REPL Access
- Node REPL with auto-completion
- tsx for TypeScript REPL
- Bun REPL as alternative

### 4. Package Management
- npm (default)
- pnpm (fast, disk-efficient)
- yarn (alternative)
- bun (fast, npm-compatible)

---

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| OLLAMA_HOST | Ollama server URL | http://localhost:11434 |
| OLLAMA_MODEL | Model to use | qwen2.5-coder:3b |
| GEMINI_API_KEY | Google AI API key | (empty) |
| OPENAI_API_KEY | OpenAI API key | (empty) |
| ANTHROPIC_API_KEY | Anthropic API key | (empty) |

---

## Testing Checklist

- [ ] Container builds successfully
- [ ] Node.js runs
- [ ] npm packages install
- [ ] TypeScript compiles
- [ ] AI SDKs import correctly
- [ ] Ollama connection works
- [ ] Agent accepts prompts
- [ ] Code execution works
- [ ] File operations work
- [ ] Error handling works

---

## Dependencies

- Node.js 22
- npm
- TypeScript
- tsx
- openai SDK
- @anthropic-ai/sdk
- @google/generative-ai
- langchain

---

## Next Steps

1. Create Dockerfile at `dockers/nodejs/Dockerfile`
2. Create agent script at `scripts/nodejs/agent.ts`
3. Build and test container
4. Connect to Ollama
5. Verify code execution
