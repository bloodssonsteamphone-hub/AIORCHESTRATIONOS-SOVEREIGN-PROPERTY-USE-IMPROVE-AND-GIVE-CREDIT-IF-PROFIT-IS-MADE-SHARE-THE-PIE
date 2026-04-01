// Smart Agents — Planner + Coder with Multi-File Support
import { createLLMClient } from '../llm/index.js';

export interface Session {
  id: string;
  prompt: string;
  status: 'pending' | 'running' | 'success' | 'failure';
  files: File[];
  error?: string;
  createdAt: number;
}

export interface File {
  path: string;
  content: string;
}

interface PlanResult {
  description: string;
  techStack: {
    frontend?: string;
    backend: string;
    database?: string;
  };
  files: string[];
}

interface CodeResult {
  files: File[];
}

// Planner Agent
async function plannerAgent(prompt: string): Promise<PlanResult> {
  const llm = await createLLMClient();
  
  const systemPrompt = `You are an expert software architect. Analyze the user's request and create a detailed, production-ready plan.

Output JSON format:
{
  "description": "What the app does",
  "techStack": {
    "frontend": "React/Vite or HTML/JS or React Native",
    "backend": "Python/Flask, Node/Express, Go/Gin, etc.",
    "database": "SQLite, PostgreSQL, MongoDB (optional)"
  },
  "files": [
    "filename.ext",
    "path/to/another.ext"
  ]
}

Rules:
- ALWAYS include: README.md, package.json or requirements.txt or go.mod
- For web apps: include index.html, src/App.jsx, src/main.jsx
- For APIs: include main server file, routes, models
- Keep it simple but COMPLETE — every file must have all imports, all functions, no placeholders
- Use modern, production-ready patterns
- For Python: use type hints, proper error handling, logging
- For React: use functional components with hooks, proper state management
- Include .env.example for any environment variables
- ALWAYS include a test file (test_app.py or test_app.test.js)`;

  const response = await llm(prompt, systemPrompt);
  
  // Parse JSON from response — try multiple strategies
  let jsonStr = response
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  // Try non-greedy match first (finds first {...} block)
  let match = jsonStr.match(/\{[\s\S]*?\}/);
  if (!match) {
    // Fallback: find any {...} with balanced braces
    const open = jsonStr.indexOf('{');
    if (open >= 0) {
      let depth = 0;
      let close = open;
      for (let i = open; i < jsonStr.length; i++) {
        if (jsonStr[i] === '{') depth++;
        if (jsonStr[i] === '}') { depth--; close = i; }
        if (depth === 0) { close = i; break; }
      }
      match = [jsonStr.slice(open, close + 1)];
    }
  }

  if (!match) throw new Error('Failed to parse plan JSON');

  let result: PlanResult;
  try {
    result = JSON.parse(match[0]);
  } catch {
    // Last resort: strip everything before first { and after last }
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        result = JSON.parse(jsonStr.slice(firstBrace, lastBrace + 1));
      } catch {
        throw new Error('Failed to parse plan JSON: ' + jsonStr.slice(firstBrace, firstBrace + 100));
      }
    } else {
      throw new Error('Failed to parse plan JSON');
    }
  }

  if (!result.techStack || !result.files) {
    throw new Error('Invalid plan format');
  }
  
  return result as PlanResult;
}

// Coder Agent
async function coderAgent(plan: PlanResult, originalPrompt: string): Promise<CodeResult> {
  const llm = await createLLMClient();
  const files: File[] = [];
  
  // Group files by type
  const backendFiles = plan.files.filter(f => 
    f.endsWith('.py') || f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.go')
  );
  const frontendFiles = plan.files.filter(f => 
    f.endsWith('.jsx') || f.endsWith('.tsx') || f.endsWith('.html') || f.endsWith('.css')
  );
  const configFiles = plan.files.filter(f => 
    f.endsWith('.json') || f.endsWith('.yaml') || f.endsWith('.yml') || f.endsWith('.md')
  );
  
  // Generate backend files
  if (backendFiles.length > 0) {
    const prompt = `You are an expert ${plan.techStack.backend || 'backend'} developer. Generate COMPLETE, RUNNABLE production code for the following files.

Project: ${plan.description}
Tech stack: ${JSON.stringify(plan.techStack)}
Files to generate: ${backendFiles.join(', ')}

CRITICAL RULES:
- Output EVERY file listed above — no skipping any file
- Every file must be COMPLETE with ALL imports, ALL functions, ALL error handling — NO placeholders, NO "// ... rest of code"
- Use type hints for Python, TypeScript for Node.js
- Add proper try/catch blocks, logging, and input validation
- Include CORS setup if web-facing
- Run the code mentally to ensure no syntax errors

Output format for EACH file:
=== FILENAME: path/to/file.ext ===
[complete file content here]

Write all files now. Start with ${backendFiles[0]}:`;

    try {
      const response = await llm(prompt, 'You are an expert backend developer. Generate complete, production-ready code. Do NOT skip any file or include placeholders.');
      const parsed = parseCodeBlocks(response);
      files.push(...parsed);
    } catch (e: any) {
      console.log('Backend error:', e.message);
    }
  }
  
  // Generate frontend files
  if (frontendFiles.length > 0) {
    const prompt = `You are an expert frontend developer. Generate COMPLETE, RUNNABLE production code for the following files.

Project: ${plan.description}
Tech stack: ${plan.techStack.frontend || 'React/Vite'}
Files to generate: ${frontendFiles.join(', ')}

CRITICAL RULES:
- Output EVERY file listed above — no skipping any file
- Every file must be COMPLETE with ALL imports, ALL components, ALL state management — NO placeholders, NO "// ... rest of code"
- Use functional components with hooks for React
- Add proper error boundaries and loading states
- Ensure all imports resolve (check package.json for deps)

Output format for EACH file:
=== FILENAME: path/to/file.ext ===
[complete file content here]

Write all files now. Start with ${frontendFiles[0]}:`;

    try {
      const response = await llm(prompt, 'You are an expert frontend developer. Generate complete, production-ready code. Do NOT skip any file or include placeholders.');
      const parsed = parseCodeBlocks(response);
      files.push(...parsed);
    } catch (e: any) {
      console.log('Frontend error:', e.message);
    }
  }
  
  // Generate config files
  for (const filePath of configFiles) {
    const prompt = `Generate content for: ${filePath}

Project: ${plan.description}
Tech stack: ${JSON.stringify(plan.techStack)}

Output format:
=== FILENAME: ${filePath} ===
[content]`;

    try {
      const response = await llm(prompt, 'You are a technical writer.');
      const parsed = parseCodeBlocks(response);
      files.push(...parsed);
    } catch (e: any) {
      console.log(`Config error for ${filePath}:`, e.message);
    }
  }
  
  // Fallback if no files generated
  if (files.length === 0) {
    const prompt = `Generate a complete simple web app for: ${originalPrompt}

Create these files:
1. README.md
2. app.py (Python Flask backend)
3. index.html (Simple frontend)
4. requirements.txt

Output format:
=== FILENAME: filename ===
[content]`;

    const response = await llm(prompt, 'Generate complete, working code.');
    const parsed = parseCodeBlocks(response);
    files.push(...parsed);
  }
  
  return { files };
}

// Parse code blocks
function parseCodeBlocks(response: string): File[] {
  const files: File[] = [];
  const regex = /=== FILENAME: ([^\s]+) ===\n([\s\S]*?)(?==== |$)/g;
  let match;
  
  while ((match = regex.exec(response)) !== null) {
    const path = match[1].trim();
    let content = match[2].trim();
    content = content.replace(/^```\w*\n?/gm, '').replace(/```$/gm, '');
    content = content.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');
    
    if (path && content) {
      files.push({ path, content });
    }
  }
  
  // Fallback: if no files parsed, try extracting from markdown code blocks
  // Look for patterns like "```python\ncode\n```" or "```\ncode\n```"
  if (files.length === 0) {
    const codeBlockRegex = /```(?:\w+)?\n?([\s\S]*?)```/g;
    const lines = response.split('\n');
    let currentFile = '';
    let currentContent: string[] = [];
    let inBlock = false;
    
    for (const line of lines) {
      const fileMatch = line.match(/^([\w\-\./]+\.(?:py|js|ts|jsx|tsx|html|css|json|yaml|yml|md|txt))$/i);
      if (fileMatch && !line.includes('```')) {
        // Save previous file
        if (currentFile && currentContent.length) {
          const content = currentContent.join('\n').replace(/^```\w*\n?/gm, '').trim();
          if (content) files.push({ path: currentFile, content });
        }
        currentFile = fileMatch[1];
        currentContent = [];
      } else if (line.startsWith('```') && currentFile) {
        inBlock = !inBlock;
        if (!inBlock && currentContent.length) {
          const content = currentContent.join('\n').replace(/^```\w*\n?/gm, '').trim();
          if (content) files.push({ path: currentFile, content });
          currentFile = '';
          currentContent = [];
        }
      } else if (inBlock || (currentFile && currentContent.length > 0)) {
        currentContent.push(line);
      }
    }
    // Last file
    if (currentFile && currentContent.length) {
      const content = currentContent.join('\n').replace(/^```\w*\n?/gm, '').trim();
      if (content) files.push({ path: currentFile, content });
    }
    
    // Last resort: extract any code blocks with language hints and assign generic names
    if (files.length === 0) {
      let blockIdx = 0;
      const blockMatches = response.matchAll(/```(\w*)\n?([\s\S]*?)```/g);
      for (const bm of blockMatches) {
        const lang = bm[1] || 'txt';
        const code = bm[2].trim();
        if (code.length > 50) {
          const ext = lang === 'python' ? 'py' : lang === 'javascript' ? 'js' : lang === 'typescript' ? 'ts' : lang === 'html' ? 'html' : lang === 'css' ? 'css' : lang === 'json' ? 'json' : lang === 'markdown' ? 'md' : 'txt';
          files.push({ path: `generated_${++blockIdx}.${ext}`, content: code });
        }
      }
    }
  }
  
  return files;
}

// Main orchestration
export async function runBuild(sessionId: string, prompt: string): Promise<Session> {
  console.log(`[Planner] Analyzing: ${prompt}`);
  
  const session: Session = {
    id: sessionId,
    prompt,
    status: 'running',
    files: [],
    createdAt: Date.now(),
  };
  
  try {
    const plan = await plannerAgent(prompt);
    console.log(`[Planner] ${plan.description}`);
    console.log(`[Planner] Stack: ${plan.techStack.backend}`);
    console.log(`[Planner] Files: ${plan.files.join(', ')}`);
    
    console.log('[Coder] Generating code...');
    const result = await coderAgent(plan, prompt);
    
    session.files = result.files;
    session.status = 'success';
    console.log(`[Coder] Generated ${result.files.length} files`);
    
    // Run tests after code generation
    await runTestsAfterBuild(session, plan);
    
  } catch (error: any) {
    console.log(`[Error] ${error.message}`);
    session.status = 'failure';
    session.error = error.message;
  }
  
  return session;
}

// Wire test-runner into build pipeline
async function runTestsAfterBuild(session: Session, plan: PlanResult): Promise<void> {
  const { invokeTool } = await import('../tools/index.js');
  
  // Detect test framework from file types
  const hasPython = session.files.some(f => f.path.endsWith('.py'));
  const hasJS = session.files.some(f => f.path.match(/\.(js|ts|jsx|tsx)$/));
  
  let testFramework: string | undefined;
  if (hasPython) testFramework = 'pytest';
  else if (hasJS) testFramework = 'vitest';
  
  if (!testFramework) {
    console.log('[Tester] No testable files detected, skipping tests');
    return;
  }
  
  console.log(`[Tester] Running ${testFramework} on generated files...`);
  
  // Write files to temp dir for testing
  const tmpDir = `/tmp/zo-build-${session.id}`;
  const { mkdirSync, writeFileSync } = await import('fs');
  mkdirSync(tmpDir, { recursive: true });
  
  for (const file of session.files) {
    const filePath = `${tmpDir}/${file.path}`;
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, file.content);
  }
  
  try {
    const result = await invokeTool('test-runner', {
      framework: testFramework,
      cwd: tmpDir,
      pattern: testFramework === 'pytest' ? 'test_*.py' : '*.test.(js|ts|tsx)',
    });
    
    if (result.success) {
      console.log(`[Tester] ✅ Tests passed`);
      (session as any).testResult = { status: 'passed', output: result.data };
    } else {
      console.log(`[Tester] ⚠️ Tests failed or not found: ${result.error}`);
      (session as any).testResult = { status: 'failed', output: result.error };
    }
  } catch (e: any) {
    console.log(`[Tester] ⚠️ Test runner error: ${e.message}`);
    (session as any).testResult = { status: 'error', output: e.message };
  }
}

export { plannerAgent, coderAgent, parseCodeBlocks };
