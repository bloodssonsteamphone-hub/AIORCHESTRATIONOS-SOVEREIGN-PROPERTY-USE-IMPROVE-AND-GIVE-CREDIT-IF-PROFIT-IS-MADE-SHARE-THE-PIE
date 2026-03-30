FROM oven/bun:1.1-alpine

# Install system tools
RUN apk add --no-cache \
    git curl bash vim nano jq \
    python3 make g++

# Install AI SDKs via bun
RUN bun add -g openai @anthropic-ai/sdk

# Install CLI tools
RUN bun add -g serve http-server nodemon

# Install AI agent frameworks
RUN bun add -g llm-client assistant-js

WORKDIR /app

COPY agent.ts /app/agent.ts

EXPOSE 8888

CMD ["bun", "/app/agent.ts"]
