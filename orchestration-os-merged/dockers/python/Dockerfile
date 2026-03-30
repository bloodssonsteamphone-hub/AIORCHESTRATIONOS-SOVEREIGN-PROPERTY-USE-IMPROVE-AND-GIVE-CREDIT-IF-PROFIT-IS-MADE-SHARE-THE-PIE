FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y git curl wget jq vim nano build-essential && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir openai anthropic google-generativeai langchain crewai sqlalchemy pandas numpy rich click httpx aiohttp
EXPOSE 8888
CMD ["python", "-c", "print('Zo Orchestration OS - Python runtime ready')"]
