FROM node:22-alpine

# Install system tools
RUN apk add --no-cache \
    git curl bash vim nano jq \
    python3 make g++ \
    zsh fish fzf ripgrep

# Install Node.js AI SDKs
RUN npm install -g openai @anthropic-ai/sdk

# Install TypeScript ecosystem
RUN npm install -g typescript tsx ts-node \
    @types/node @types/typescript

# Install CLI tools
RUN npm install -g serve http-server \
    nodemon pm2

# Install AI agent frameworks
RUN npm install -g \
    llm-client \
    assistant-js

WORKDIR /app

# Copy agent script
COPY agent.ts /app/agent.ts

EXPOSE 8888

CMD ["node", "/app/agent.ts"]
