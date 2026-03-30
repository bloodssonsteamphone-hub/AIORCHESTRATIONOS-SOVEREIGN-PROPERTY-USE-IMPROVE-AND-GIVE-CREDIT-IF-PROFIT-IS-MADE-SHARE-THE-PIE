FROM golang:1.23-alpine

# Install system tools
RUN apk add --no-cache \
    git curl wget bash vim nano jq \
    build-base \
    alpine-sdk

# Install Go AI/CLI tools
RUN go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest && \
    go install mvdan.cc/gofumpt@latest && \
    go install github.com/rakyll/hey@latest

# Install AI SDKs
RUN go install github.com/sashabaranov/go-openai@latest && \
    go install github.com/google/generative-ai-go@latest && \
    go install github.com/crewai/crewai-go@latest

# Install CLI tools
RUN go install github.com/jesseduffield/lazygit@latest && \
    go install github.com/wtfutil/wtf@latest

WORKDIR /app

# Copy agent script
COPY agent.go /app/agent.go

EXPOSE 8888

CMD ["go", "run", "agent.go"]
