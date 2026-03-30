#!/usr/bin/env bun
/**
 * Bun AI Agent - CLI Tool
 * Accepts natural language prompts and generates/executes JavaScript/TypeScript code
 */

const { execSync } = require('child_process');
const { writeFileSync, unlinkSync } = require('fs');

const OLLAMA_HOST = process.env['OLLAMA_HOST'] || 'http://localhost:11434';
const OLLAMA_MODEL = process.env['OLLAMA_MODEL'] || 'qwen2.5-coder:3b';
const GEMINI_API_KEY = process.env['GEMINI_API_KEY'] || '';
const OUTPUT_DIR = process.env['OUTPUT_DIR'] || '/tmp';

const COLOR = {
  red: '\x1b[0;31m',
  green: '\x1b[0;32m',
  yellow: '\x1b[1;33m',
  reset: '\x1b[0m'
};

function log(level: 'info' | 'error' | 'warn', msg: string) {
  const prefix = level === 'info' ? `${COLOR.green}[Agent]${COLOR.reset}` :
                 level === 'error' ? `${COLOR.red}[Error]${COLOR.reset}` :
                 `${COLOR.yellow}[Warn]${COLOR.reset}`;
  console.error(`${prefix} ${msg}`);
}

async function callOllama(prompt: string): Promise<string | null> {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: 'user', content: prompt }],
        stream: false
      })
    });
    const result = await res.json();
    return result?.message?.content ?? null;
  } catch (e) {
    log('warn', `Ollama call failed: ${e}`);
    return null;
  }
}

async function callGemini(prompt: string): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
        })
      }
    );
    const result = await res.json();
    return result?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch (e) {
    log('warn', `Gemini call failed: ${e}`);
    return null;
  }
}

function cleanCode(raw: string): string {
  return raw
    .replace(/```(?:javascript|js|typescript|ts|bun)?/gi, '')
    .replace(/```/g, '')
    .replace(/`/g, '')
    .trim();
}

async function generateCode(prompt: string): Promise<string | null> {
  const fullPrompt = `Generate ONLY JavaScript/TypeScript code for: ${prompt}\n\nRules:
- Output ONLY the code, no explanations
- No markdown code blocks
- Code must be valid Bun/JavaScript/TypeScript
- Include proper import/require statements
- No bash commands or shell script`;

  let result = await callOllama(fullPrompt);
  if (!result) result = await callGemini(fullPrompt);
  if (!result) return null;

  return cleanCode(result);
}

async function executeCode(code: string): Promise<{ output: string; exitCode: number }> {
  const tmpFile = `${OUTPUT_DIR}/agent_${Date.now()}.ts`;
  writeFileSync(tmpFile, code);

  try {
    const output = execSync(`bun "${tmpFile}"`, { encoding: 'utf8', timeout: 60000 });
    return { output, exitCode: 0 };
  } catch (e: unknown) {
    const err = e as { stderr?: string; status?: number };
    return {
      output: (err.stderr || String(e)),
      exitCode: err.status ?? 1
    };
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

async function testConnection() {
  log('info', 'Testing LLM connectivity...');

  const ollamaResult = await callOllama('Say "OK" in exactly one word');
  if (ollamaResult && ollamaResult.toLowerCase().includes('ok')) {
    log('info', 'Ollama connection: OK');
  } else {
    log('error', 'Ollama connection: FAILED');
  }

  if (GEMINI_API_KEY) {
    const geminiResult = await callGemini('Say "OK" in exactly one word');
    if (geminiResult && geminiResult.toLowerCase().includes('ok')) {
      log('info', 'Gemini connection: OK');
    } else {
      log('error', 'Gemini connection: FAILED');
    }
  } else {
    log('info', 'Gemini: Not configured');
  }
}

function showHelp() {
  console.log(`Bun AI Agent - Generate and execute JavaScript/TypeScript using AI

Usage: bun agent.ts <prompt>
       bun agent.ts --test

Examples:
  bun agent.ts "Read a JSON file and print its keys"
  bun agent.ts "Fetch JSON from an API and display it"
  bun agent.ts --test

Environment Variables:
  OLLAMA_HOST      Ollama server URL (default: http://localhost:11434)
  OLLAMA_MODEL     Model to use (default: qwen2.5-coder:3b)
  GEMINI_API_KEY   Google Gemini API key (optional)
  OUTPUT_DIR       Temp directory for code execution (default: /tmp)
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    showHelp();
    process.exit(1);
  }

  if (args[0] === '--test') {
    await testConnection();
    return;
  }

  if (args[0] === '--help' || args[0] === '-h') {
    showHelp();
    return;
  }

  const prompt = args.join(' ');
  log('info', `Generating code for: ${prompt}`);

  const code = await generateCode(prompt);
  if (!code) {
    log('error', 'No LLM available and no code generated');
    process.exit(1);
  }

  log('info', `Generated ${code.split('\n').length} lines of code`);
  console.log(`\n--- Generated Code ---\n${code}\n--- End Code ---\n`);

  log('info', 'Executing...');
  const { output, exitCode } = await executeCode(code);

  console.log(output);
  process.exit(exitCode);
}

main().catch(e => {
  log('error', `Fatal: ${e}`);
  process.exit(1);
});
