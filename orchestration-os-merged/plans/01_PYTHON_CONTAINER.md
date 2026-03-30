# Python Container Plan

## Status: NOT STARTED

## Vision
Create a Docker container with:
- Python 3.12 runtime
- All major AI/ML SDKs pre-installed
- Interactive REPL (IPython)
- AI Agent wrapper that can call LLMs
- File editing and terminal access
- Git version control

---

## Components Needed

### 1. Dockerfile
**Path:** `dockers/python/Dockerfile`

```dockerfile
FROM python:3.12-slim

# Install system tools
RUN apt-get update && apt-get install -y \
    git curl wget vim nano jq \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python tools
RUN pip install --no-cache-dir \
    pipenv poetry \
    black flake8 ruff mypy \
    ipython ptpython

# Install AI/ML SDKs
RUN pip install --no-cache-dir \
    openai anthropic google-generativeai \
    langchain langchain-openai langchain-anthropic \
    langgraph crewai autogen \
    sqlalchemy pandas numpy \
    jupyter jupyterlab

# Install CLI tools
RUN pip install --no-cache-dir \
    httpie httpie-oauth \
    requests httpx aiohttp \
    rich click typer

# Create app directory
WORKDIR /app

# Copy agent script
COPY agent.py /app/agent.py

# Default command
CMD ["python", "/app/agent.py"]
```

### 2. AI Agent Script
**Path:** `scripts/python/agent.py`

Features:
- [ ] Accept natural language prompts
- [ ] Write Python code
- [ ] Execute Python code
- [ ] Return results/errors
- [ ] Use Ollama when available
- [ ] Fallback to cloud APIs
- [ ] Support file operations
- [ ] Support command execution

### 3. Terminal/REPL Access
- IPython with auto-completion
- Jupyter-compatible interface
- Rich terminal output

### 4. Package Management
- pip (legacy)
- pipenv (deterministic)
- poetry (modern, recommended)

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

## Port Exposures

| Port | Service | Notes |
|------|---------|-------|
| 8888 | Jupyter | Optional, for notebooks |

---

## Volume Mounts

| Path | Purpose |
|------|---------|
| /app/workspace | Shared workspace |
| /app/.python History | REPL history |

---

## Testing Checklist

- [ ] Container builds successfully
- [ ] Python runs
- [ ] pip packages install
- [ ] AI SDKs import correctly
- [ ] Ollama connection works
- [ ] Agent accepts prompts
- [ ] Code execution works
- [ ] File operations work
- [ ] Error handling works

---

## Dependencies

- Python 3.12
- pip
- IPython
- langchain
- openai SDK
- anthropic SDK
- google-generativeai SDK

---

## Next Steps

1. Create Dockerfile at `dockers/python/Dockerfile`
2. Create agent script at `scripts/python/agent.py`
3. Build and test container
4. Connect to Ollama
5. Verify code execution
6. Optimize image size
