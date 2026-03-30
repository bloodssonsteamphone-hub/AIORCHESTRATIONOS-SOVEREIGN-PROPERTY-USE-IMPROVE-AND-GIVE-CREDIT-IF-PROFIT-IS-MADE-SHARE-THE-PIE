FROM deno:alpine
WORKDIR /app
RUN apk add --no-cache git curl wget jq bash vim nano
RUN deno install -g openai anthropic
EXPOSE 8888
CMD ["deno", "-e", "console.log('Zo Orchestration OS - Deno runtime ready')"]
