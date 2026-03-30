#!/bin/bash
# Bash AI Agent - CLI Tool
# Accepts natural language prompts and executes bash commands

# Don't use set -e as we need to handle errors gracefully

OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"
OLLAMA_MODEL="${OLLAMA_MODEL:-qwen2.5-coder:3b}"
GEMINI_API_KEY="${GEMINI_API_KEY:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[Agent]${NC} $1" >&2
}

log_error() {
    echo -e "${RED}[Error]${NC} $1" >&2
}

call_ollama() {
    local prompt="$1"
    curl -s -X POST "${OLLAMA_HOST}/api/chat" \
        -H "Content-Type: application/json" \
        -d "{\"model\":\"${OLLAMA_MODEL}\",\"messages\":[{\"role\":\"user\",\"content\":\"${prompt}\"}],\"stream\":false}" \
        2>/dev/null | jq -r '.message.content // empty'
}

call_gemini() {
    local prompt="$1"
    if [ -z "$GEMINI_API_KEY" ]; then
        return 1
    fi
    
    curl -s -X POST \
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"contents\":[{\"parts\":[{\"text\":\"${prompt}\"}]}],\"generationConfig\":{\"temperature\":0.7,\"maxOutputTokens\":8192}}" \
        2>/dev/null | jq -r '.candidates[0].content.parts[0].text // empty'
}

clean_code() {
    # Remove triple backticks with language
    sed -E 's/```bash//g' | sed -E 's/```sh//g' | sed -E 's/```//g' | \
    tr -d '`' | \
    # Extract only lines that look like bash commands
    # Commands can be alone on a line or followed by args
    grep -E '^[[:space:]]*(ls|cd|cat|echo|grep|find|awk|sed|curl|wget|sudo|apt|apt-get|npm|pip|mkdir|rm|cp|mv|chmod|chown|tar|zip|ssh|scp|export|source|bash|sh|exit|pwd|date|whoami|id|uname|ps|kill|head|tail|sort|uniq|wc|jq|yq|fzf)[[:space:]]*' | \
    head -1 | \
    sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
}

generate_command() {
    local prompt="$1"
    local full_prompt="Generate ONLY a bash command for: ${prompt}

Only output the command, nothing else."

    # Try Ollama first
    local result
    if result=$(call_ollama "$full_prompt"); then
        echo "$result" | clean_code
        return 0
    fi
    
    # Fallback to Gemini
    if result=$(call_gemini "$full_prompt"); then
        echo "$result" | clean_code
        return 0
    fi
    
    log_error "No LLM available"
    return 1
}

execute_command() {
    local cmd="$1"
    log_info "Executing: $cmd"
    
    # Execute and capture result
    set +e
    output=$(eval "$cmd" 2>&1)
    exit_code=$?
    set -e
    
    echo "$output"
    return $exit_code
}

show_help() {
    cat << EOF
Bash AI Agent - Generate and execute bash commands using AI

Usage: agent.sh <prompt>
       agent.sh --test

Examples:
  agent.sh "List all files in current directory"
  agent.sh "Find all Python files modified in last 24 hours"
  agent.sh "Show disk usage for home directory"
  agent.sh --test

Environment Variables:
  OLLAMA_HOST      Ollama server URL (default: http://localhost:11434)
  OLLAMA_MODEL     Model to use (default: qwen2.5-coder:3b)
  GEMINI_API_KEY   Google Gemini API key (optional)

EOF
}

main() {
    if [ $# -eq 0 ]; then
        show_help
        exit 1
    fi
    
    if [ "$1" = "--test" ]; then
        log_info "Testing LLM connectivity..."
        if call_ollama "Say 'Hello' in exactly one word" > /dev/null 2>&1; then
            log_info "Ollama connection: OK"
        else
            log_error "Ollama connection: FAILED"
        fi
        if [ -n "$GEMINI_API_KEY" ]; then
            if call_gemini "Say 'Hello' in exactly one word" > /dev/null 2>&1; then
                log_info "Gemini connection: OK"
            else
                log_error "Gemini connection: FAILED"
            fi
        else
            log_info "Gemini: Not configured"
        fi
        exit 0
    fi
    
    local prompt="$*"
    log_info "Generating command for: $prompt"
    
    local cmd
    cmd=$(generate_command "$prompt") || {
        log_error "Failed to generate command"
        exit 1
    }
    
    if [ -z "$cmd" ]; then
        log_error "Empty command generated"
        exit 1
    fi
    
    log_info "Generated: $cmd"
    
    local output
    local exit_code
    output=$(execute_command "$cmd")
    exit_code=$?
    
    echo "$output"
    return $exit_code
}

main "$@"
