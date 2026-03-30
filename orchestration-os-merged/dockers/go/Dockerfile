FROM golang:1.23-alpine
WORKDIR /app
RUN apk add --no-cache git curl wget jq bash vim nano
RUN go install openai.com/samples/ai-sdk-go@latest 2>/dev/null || true
EXPOSE 8888
CMD ["go", "run", "-e", "package main; import \"fmt\"; func main() { fmt.Println(\"Zo Orchestration OS - Go runtime ready\") }"]
