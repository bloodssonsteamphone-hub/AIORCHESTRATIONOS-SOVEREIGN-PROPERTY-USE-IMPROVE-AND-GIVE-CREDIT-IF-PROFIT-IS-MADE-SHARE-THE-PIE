#!/usr/bin/env python3
"""
Python AI Agent - CLI Tool
Accepts natural language prompts and executes Python code
"""

import os
import sys
import json
import subprocess
import re
from typing import Optional

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5-coder:3b")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

def call_ollama(prompt: str) -> Optional[str]:
    """Call Ollama for code generation"""
    import urllib.request
    import urllib.error
    
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False
    }
    
    try:
        req = urllib.request.Request(
            f"{OLLAMA_HOST}/api/chat",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=120) as response:
            result = json.loads(response.read().decode())
            return result.get("message", {}).get("content", "")
    except Exception as e:
        print(f"Ollama error: {e}", file=sys.stderr)
        return None

def call_gemini(prompt: str) -> Optional[str]:
    """Call Gemini API for code generation"""
    if not GEMINI_API_KEY:
        return None
    
    import urllib.request
    import urllib.error
    
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 8192}
    }
    
    try:
        req = urllib.request.Request(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.loads(response.read().decode())
            return result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
    except Exception as e:
        print(f"Gemini error: {e}", file=sys.stderr)
        return None

def generate_code(prompt: str) -> str:
    """Generate Python code from prompt using available LLM"""
    full_prompt = f"""You are an expert Python programmer. Generate ONLY Python code for this request:

{prompt}

RULES:
- Output ONLY Python code, nothing else
- NO explanations, NO comments describing what the code does
- NO markdown formatting, NO backticks, NO code block markers
- Code must be valid Python syntax
- Code must be complete and runnable

Output just the raw Python code now:"""

    # Try Ollama first
    result = call_ollama(full_prompt)
    if result:
        return clean_code(result)
    
    # Fallback to Gemini
    result = call_gemini(full_prompt)
    if result:
        return clean_code(result)
    
    raise Exception("No LLM available - configure OLLAMA_HOST or GEMINI_API_KEY")

def clean_code(raw: str) -> str:
    """Clean markdown formatting and extract code"""
    # Remove triple backticks and language specifiers
    code = re.sub(r'^```python\s*', '', raw, flags=re.MULTILINE)
    code = re.sub(r'^```\s*$', '', code, flags=re.MULTILINE)
    code = re.sub(r'^```py\s*', '', code, flags=re.MULTILINE)
    # Remove leading backticks
    code = re.sub(r'^`+', '', code, flags=re.MULTILINE)
    # Remove trailing backticks
    code = re.sub(r'`+$', '', code, flags=re.MULTILINE)
    return code.strip()

def execute_code(code: str) -> tuple[str, str, int]:
    """Execute Python code and return stdout, stderr, returncode"""
    try:
        result = subprocess.run(
            ["python3", "-c", code],
            capture_output=True,
            text=True,
            timeout=30
        )
        return result.stdout, result.stderr, result.returncode
    except subprocess.TimeoutExpired:
        return "", "Execution timed out (30s limit)", 124
    except Exception as e:
        return "", str(e), 1

def main():
    if len(sys.argv) < 2:
        print("Usage: python agent.py <prompt>", file=sys.stderr)
        print("Example: python agent.py 'Print hello world 10 times'", file=sys.stderr)
        sys.exit(1)
    
    prompt = " ".join(sys.argv[1:])
    print(f"[Agent] Generating code for: {prompt}", file=sys.stderr)
    
    try:
        # Generate code
        code = generate_code(prompt)
        print(f"[Agent] Generated {len(code)} chars of code", file=sys.stderr)
        
        # Execute code
        stdout, stderr, returncode = execute_code(code)
        
        # Output results
        if stdout:
            print(stdout)
        if stderr:
            print(f"[Error] {stderr}", file=sys.stderr)
        
        sys.exit(returncode)
        
    except Exception as e:
        print(f"[Agent Error] {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
