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
  
  const systemPrompt = `You are an expert software architect. Analyze the user's request and create a detailed plan.

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
- Keep it simple but complete
- Use modern, production-ready patterns`;

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
    const prompt = `Generate COMPLETE code for: ${backendFiles.join(', ')}

Project: ${plan.description}
Tech stack: ${JSON.stringify(plan.techStack)}

Output format:
=== FILENAME: path/to/file.ext ===
[complete code here]

Write REAL, RUNNABLE code with all imports and error handling.`;

    try {
      const response = await llm(prompt, 'You are an expert backend developer.');
      const parsed = parseCodeBlocks(response);
      files.push(...parsed);
    } catch (e: any) {
      console.log('Backend error:', e.message);
    }
  }
  
  // Generate frontend files
  if (frontendFiles.length > 0) {
    const prompt = `Generate COMPLETE code for: ${frontendFiles.join(', ')}

Project: ${plan.description}
Tech stack: ${plan.techStack.frontend || 'React/Vite'}

Output format:
=== FILENAME: path/to/file.jsx ===
[complete code here]

Write REAL, RUNNABLE React/HTML code with proper imports.`;

    try {
      const response = await llm(prompt, 'You are an expert frontend developer.');
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
    
  } catch (error: any) {
    console.log(`[Error] ${error.message}`);
    session.status = 'failure';
    session.error = error.message;
  }
  
  return session;
}

export { plannerAgent, coderAgent, parseCodeBlocks };
