#!/usr/bin/env -S deno run --allow-all
/**
 * Deno AI Agent - CLI Tool
 * Accepts natural language prompts and generates/executes TypeScript/JavaScript code
 */

const OLLAMA_HOST = Deno.env.get('OLLAMA_HOST') || 'http://localhost:11434';
const OLLAMA_MODEL = Deno.env.get('OLLAMA_MODEL') || 'qwen2.5-coder:3b';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const OUTPUT_DIR = Deno.env.get('OUTPUT_DIR') || '/tmp';

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
    .replace(/```(?:javascript|js|typescript|ts|deno)?/gi, '')
    .replace(/```/g, '')
    .replace(/`/g, '')
    .trim();
}

async function generateCode(prompt: string): Promise<string | null> {
  const fullPrompt = `Generate ONLY TypeScript/JavaScript code for: ${prompt}\n\nRules:
- Output ONLY the code, no explanations
- No markdown code blocks
- Code must be valid Deno/TypeScript/JavaScript
- Use 'import' statements for modules
- No bash commands or shell script`;

  let result = await callOllama(fullPrompt);
  if (!result) result = await callGemini(fullPrompt);
  if (!result) return null;

  return cleanCode(result);
}

async function executeCode(code: string): Promise<{ output: string; exitCode: number }> {
  const tmpFile = `${OUTPUT_DIR}/agent_${Date.now()}.ts`;
  await Deno.writeTextFile(tmpFile, code);

  try {
    const p = Deno.run({
      cmd: ['deno', 'run', '--allow-all', tmpFile],
      stdout: 'piped',
      stderr: 'piped'
    });
    const [output, stderr] = await Promise.all([
      p.output(),
      p.stderrOutput()
    ]);
    const status = await p.status();
    p.close();
    return {
      output: new TextDecoder().decode(output),
      exitCode: status.code
    };
  } catch (e) {
    return { output: String(e), exitCode: 1 };
  } finally {
    try { await Deno.remove(tmpFile); } catch {}
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
  console.log(`Deno AI Agent - Generate and execute TypeScript/JavaScript using AI

Usage: deno run --allow-all agent.ts <prompt>
       deno run --allow-all agent.ts --test

Examples:
  deno run --allow-all agent.ts "Read a JSON file and print its keys"
  deno run --allow-all agent.ts "Fetch JSON from an API and display it"
  deno run --allow-all agent.ts --test

Environment Variables:
  OLLAMA_HOST      Ollama server URL (default: http://localhost:11434)
  OLLAMA_MODEL     Model to use (default: qwen2.5-coder:3b)
  GEMINI_API_KEY   Google Gemini API key (optional)
  OUTPUT_DIR       Temp directory for code execution (default: /tmp)
`);
}

async function main() {
  const args = Deno.args;

  if (args.length === 0) {
    showHelp();
    Deno.exit(1);
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
    Deno.exit(1);
  }

  log('info', `Generated ${code.split('\n').length} lines of code`);
  console.log(`\n--- Generated Code ---\n${code}\n--- End Code ---\n`);

  log('info', 'Executing...');
  const { output, exitCode } = await executeCode(code);

  console.log(output);
  Deno.exit(exitCode);
}

main().catch(e => {
  log('error', `Fatal: ${e}`);
  Deno.exit(1);
});
