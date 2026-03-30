FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache git curl wget jq vim nano
RUN npm install -g openai @anthropic-ai/sdk typescript ts-node
EXPOSE 8888
CMD ["node", "-e", "console.log('Zo Orchestration OS - Node.js runtime ready')"]
