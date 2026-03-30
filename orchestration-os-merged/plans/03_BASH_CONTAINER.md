# Bash Container Plan

## Status: NOT STARTED

## Vision
Create a Docker container with:
- Bash 5.2 shell
- Modern Unix tools (jq, yq, fzf, ripgrep)
- AI helper script that calls LLMs via curl
- Full terminal access
- Git version control
- Essential text processing tools

---

## Components Needed

### 1. Dockerfile
**Path:** `dockers/bash/Dockerfile`

```dockerfile
FROM bash:5.2-alpine

# Install modern Unix tools
RUN apk add --no-cache \
    git curl wget \
    vim nano \
    jq yq \
    fzf ripgrep fd \
    bat catwalk \
    httpie curl \
    zsh fish \
    make cmake \
    build-base \
    python3 py3-pip

# Install AI tools via pip
RUN pip3 install --no-cache-dir \
    anthropic openai \
    requests httpx

# Create app directory
WORKDIR /app

# Copy agent script
COPY agent.sh /app/agent.sh

# Make agent executable
RUN chmod +x /app/agent.sh

# Default command
CMD ["/app/agent.sh"]
```

### 2. AI Agent Script
**Path:** `scripts/bash/agent.sh`

Features:
- [ ] Accept natural language prompts
- [ ] Write Bash scripts
- [ ] Execute scripts
- [ ] Return results/errors
- [ ] Use Ollama when available
- [ ] Fallback to cloud APIs
- [ ] Support file operations
- [ ] Support command execution
- [ ] Pipeline support

### 3. Terminal/REPL Access
- Bash REPL
- Optional: zsh, fish
- Readline editing

### 4. Essential Tools
- jq - JSON processing
- yq - YAML processing
- fzf - Fuzzy finder
- ripgrep - Fast grep
- bat - Cat with syntax highlighting
- httpie - Human-friendly curl

---

## Testing Checklist

- [ ] Container builds successfully
- [ ] Bash runs
- [ ] jq works for JSON
- [ ] fzf works
- [ ] Git works
- [ ] Ollama connection works
- [ ] Agent accepts prompts
- [ ] Script execution works
- [ ] File operations work
- [ ] Error handling works

---

## Dependencies

- Bash 5.2
- jq
- yq
- fzf
- ripgrep
- git
- curl
- python3 (for AI SDKs)

---

## Next Steps

1. Create Dockerfile at `dockers/bash/Dockerfile`
2. Create agent script at `scripts/bash/agent.sh`
3. Build and test container
4. Connect to Ollama
5. Verify script execution
