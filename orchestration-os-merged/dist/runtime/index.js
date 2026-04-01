// Phase 1 — Runtime Manager (executes code in Python, Node, Bash, etc.)
import { spawn } from 'child_process';
const runtimes = {
    python3: { name: 'python3', version: '', available: false, command: 'python3' },
    node: { name: 'node', version: '', available: false, command: 'node' },
    bash: { name: 'bash', version: '', available: false, command: 'bash' },
    deno: { name: 'deno', version: '', available: false, command: 'deno' },
    bun: { name: 'bun', version: '', available: false, command: 'bun' },
    ruby: { name: 'ruby', version: '', available: false, command: 'ruby' },
    go: { name: 'go', version: '', available: false, command: 'go' },
    rustc: { name: 'rustc', version: '', available: false, command: 'rustc' },
    java: { name: 'java', version: '', available: false, command: 'java' },
};
function execPromise(cmd, args) {
    return new Promise((resolve) => {
        const proc = spawn(cmd, args);
        let stdout = '', stderr = '';
        proc.stdout?.on('data', d => stdout += d.toString());
        proc.stderr?.on('data', d => stderr += d.toString());
        proc.on('close', code => resolve({ stdout, stderr, exitCode: code || 0 }));
        proc.on('error', () => resolve({ stdout, stderr, exitCode: 1 }));
    });
}
async function detectRuntimes() {
    const checks = [
        { key: 'python3', args: ['--version'] },
        { key: 'node', args: ['--version'] },
        { key: 'bash', args: ['--version'] },
        { key: 'deno', args: ['--version'] },
        { key: 'bun', args: ['--version'] },
        { key: 'ruby', args: ['--version'] },
        { key: 'go', args: ['version'] },
        { key: 'rustc', args: ['--version'] },
        { key: 'java', args: ['-version'] },
    ];
    const results = await Promise.allSettled(checks.map(async ({ key, args }) => {
        const info = runtimes[key];
        const result = await execPromise(info.command, args);
        if (result.exitCode === 0) {
            const version = result.stdout.trim().split('\n')[0] || result.stderr.trim().split('\n')[0] || 'unknown';
            runtimes[key] = { ...info, version: version.slice(0, 50), available: true };
        }
    }));
}
detectRuntimes();
export function listRuntimes() {
    return Object.values(runtimes);
}
export async function executeCode(code, runtimeName) {
    const info = runtimes[runtimeName];
    if (!info)
        throw new Error(`Runtime ${runtimeName} not known`);
    if (!info.available)
        throw new Error(`Runtime ${runtimeName} not available`);
    const { writeFileSync } = await import('fs');
    const ext = { python3: 'py', node: 'js', bash: 'sh', deno: 'ts', bun: 'ts', ruby: 'rb', go: 'go', rustc: 'rs', java: 'java' };
    const tmpFile = `/tmp/zo-exec-${Date.now()}.${ext[runtimeName] || 'txt'}`;
    writeFileSync(tmpFile, code);
    const start = Date.now();
    let args = [tmpFile];
    // Java needs special handling
    if (runtimeName === 'java') {
        const className = code.match(/public class (\w+)/)?.[1] || 'Main';
        const baseDir = '/tmp';
        writeFileSync(`${baseDir}/${className}.java`, code);
        await execPromise('javac', [`${baseDir}/${className}.java`]);
        args = ['-cp', baseDir, className];
    }
    const result = await execPromise(info.command, args);
    return { ...result, duration: Date.now() - start };
}
export { runtimes };
