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
    crewai autogen \
    sqlalchemy pandas numpy

# Install CLI tools
RUN pip install --no-cache-dir \
    httpie requests httpx aiohttp \
    rich click typer

WORKDIR /app

# Copy agent script
COPY agent.py /app/agent.py

# Expose port for REPL if needed
EXPOSE 8888

CMD ["python", "/app/agent.py"]
