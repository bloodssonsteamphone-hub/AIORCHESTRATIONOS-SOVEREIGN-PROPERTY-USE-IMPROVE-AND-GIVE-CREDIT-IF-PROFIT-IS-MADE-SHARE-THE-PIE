package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"time"
)

var (
	ollamaHost  = getEnv("OLLAMA_HOST", "http://localhost:11434")
	ollamaModel = getEnv("OLLAMA_MODEL", "qwen2.5-coder:3b")
	geminiAPIKey = os.Getenv("GEMINI_API_KEY")
)

type OllamaRequest struct {
	Model    string                   `json:"model"`
	Messages []map[string]interface{} `json:"messages"`
	Stream   bool                     `json:"stream"`
}

type OllamaResponse struct {
	Message struct {
		Content string `json:"content"`
	} `json:"message"`
}

type GeminiRequest struct {
	Contents []map[string]interface{} `json:"contents"`
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func callOllama(prompt string) (string, error) {
	reqBody := OllamaRequest{
		Model: ollamaModel,
		Messages: []map[string]interface{}{
			{"role": "user", "content": prompt},
		},
		Stream: false,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	client := &http.Client{Timeout: 120 * time.Second}
	req, err := http.NewRequest("POST", ollamaHost+"/api/chat", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result OllamaResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	return result.Message.Content, nil
}

func callGemini(prompt string) (string, error) {
	if geminiAPIKey == "" {
		return "", fmt.Errorf("GEMINI_API_KEY not set")
	}

	reqBody := GeminiRequest{
		Contents: []map[string]interface{}{
			{"parts": []map[string]string{{"text": prompt}}},
		},
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=%s", geminiAPIKey)
	client := &http.Client{Timeout: 60 * time.Second}
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	candidates, ok := result["candidates"].([]interface{})
	if !ok || len(candidates) == 0 {
		return "", fmt.Errorf("no candidates in response")
	}

	candidate, ok := candidates[0].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("invalid candidate format")
	}

	content, ok := candidate["content"].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("no content in candidate")
	}

	parts, ok := content["parts"].([]interface{})
	if !ok || len(parts) == 0 {
		return "", fmt.Errorf("no parts in content")
	}

	part, ok := parts[0].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("invalid part format")
	}

	text, ok := part["text"].(string)
	if !ok {
		return "", fmt.Errorf("no text in part")
	}

	return text, nil
}

func generateCode(prompt string) (string, error) {
	fullPrompt := fmt.Sprintf(`You are an expert Go programmer. Generate ONLY Go code for this request:

%s

RULES:
- Output ONLY Go code, nothing else
- NO explanations, NO comments describing what the code does
- NO markdown formatting, NO backticks, NO code block markers
- Code must be valid Go syntax
- Code must be complete and runnable
- Use proper error handling with if err != nil
- Use fmt for output (fmt.Println, fmt.Printf, etc.)
- Include proper imports

Output just the raw Go code now:`, prompt)

	if result, err := callOllama(fullPrompt); err == nil && result != "" {
		return cleanCode(result), nil
	}

	if result, err := callGemini(fullPrompt); err == nil && result != "" {
		return cleanCode(result), nil
	}

	return "", fmt.Errorf("no LLM available - configure OLLAMA_HOST or GEMINI_API_KEY")
}

func cleanCode(raw string) string {
	re := regexp.MustCompile("```go")
	raw = re.ReplaceAllString(raw, "")
	re = regexp.MustCompile("```")
	raw = re.ReplaceAllString(raw, "")
	raw = strings.ReplaceAll(raw, "`", "")
	return strings.TrimSpace(raw)
}

func executeCode(code string) (string, string, int) {
	tmpFile, err := os.CreateTemp("", "agent_*.go")
	if err != nil {
		return "", fmt.Sprintf("Failed to create temp file: %v", err), 1
	}
	defer os.Remove(tmpFile.Name())
	defer tmpFile.Close()

	if _, err := tmpFile.WriteString(code); err != nil {
		return "", fmt.Sprintf("Failed to write code: %v", err), 1
	}
	tmpFile.Close()

	var stdout, stderr bytes.Buffer
	cmd := exec.Command("go", "run", tmpFile.Name())
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err = cmd.Run()
	exitCode := 0
	if err != nil {
		exitCode = 1
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		}
	}

	return stdout.String(), stderr.String(), exitCode
}

func showHelp() {
	fmt.Println(`Go AI Agent - Generate and execute Go code using AI

Usage: agent <prompt>
       agent --test

Examples:
  agent "Print hello world 10 times"
  agent "Read a file and count its lines"
  agent --test

Environment Variables:
  OLLAMA_HOST      Ollama server URL (default: http://localhost:11434)
  OLLAMA_MODEL     Model to use (default: qwen2.5-coder:3b)
  GEMINI_API_KEY   Google Gemini API key (optional)
`)
}

func main() {
	if len(os.Args) < 2 {
		showHelp()
		os.Exit(1)
	}

	arg := os.Args[1]

	if arg == "--test" {
		fmt.Fprintln(os.Stderr, "[Agent] Testing LLM connectivity...")

		if _, err := callOllama("Say 'Hello' in exactly one word"); err != nil {
			fmt.Fprintf(os.Stderr, "[Error] Ollama connection: FAILED (%v)\n", err)
		} else {
			fmt.Fprintln(os.Stderr, "[Agent] Ollama connection: OK")
		}

		if geminiAPIKey != "" {
			if _, err := callGemini("Say 'Hello' in exactly one word"); err != nil {
				fmt.Fprintf(os.Stderr, "[Error] Gemini connection: FAILED (%v)\n", err)
			} else {
				fmt.Fprintln(os.Stderr, "[Agent] Gemini connection: OK")
			}
		} else {
			fmt.Fprintln(os.Stderr, "[Agent] Gemini: Not configured")
		}
		os.Exit(0)
	}

	prompt := strings.Join(os.Args[1:], " ")
	fmt.Fprintf(os.Stderr, "[Agent] Generating code for: %s\n", prompt)

	code, err := generateCode(prompt)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[Agent Error] %v\n", err)
		os.Exit(1)
	}

	fmt.Fprintf(os.Stderr, "[Agent] Generated %d chars of code\n", len(code))

	stdout, stderr, exitCode := executeCode(code)

	if stdout != "" {
		fmt.Print(stdout)
	}
	if stderr != "" {
		fmt.Fprintf(os.Stderr, "[Error] %s\n", stderr)
	}

	os.Exit(exitCode)
}
