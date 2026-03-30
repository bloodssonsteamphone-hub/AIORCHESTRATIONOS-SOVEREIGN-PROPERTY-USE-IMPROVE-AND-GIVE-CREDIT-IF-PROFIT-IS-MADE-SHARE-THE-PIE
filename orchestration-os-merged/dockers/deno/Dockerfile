FROM deno:2.0-alpine

# Install system tools
RUN apk add --no-cache \
    git curl bash vim nano jq \
    python3 make g++

# Deno permissions
RUN deno cache --reload https://deno.land/x/openai/openai.ts && \
    deno cache --reload https://deno.land/x/anthropic/mod.ts

WORKDIR /app

COPY agent.ts /app/agent.ts

EXPOSE 8888

CMD ["deno", "run", "--allow-all", "/app/agent.ts"]
