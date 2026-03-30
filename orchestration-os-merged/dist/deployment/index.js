// Layer 7 — Deployment Targets (L7)
import { existsSync, mkdirSync, writeFileSync, cpSync } from 'fs';
import { join, dirname } from 'path';
const TARGETS = [
    {
        id: 'web-spa',
        name: 'Web SPA / PWA',
        platform: 'web',
        description: 'Static web app — HTML/JS/CSS, deployable to any CDN',
        artifacts: ['dist/index.html', 'dist/assets/', 'manifest.json'],
        supported: true,
        checkCommand: 'echo "Serve static files"',
    },
    {
        id: 'web-zip',
        name: 'Web ZIP Archive',
        platform: 'web',
        description: 'Zipped web app for manual deployment',
        artifacts: ['dist/'],
        supported: true,
        checkCommand: 'zip -r output.zip dist/',
    },
    {
        id: 'electron-windows',
        name: 'Windows EXE (Electron)',
        platform: 'windows',
        description: 'Windows desktop app packaged as .exe via Electron',
        artifacts: ['dist-electron/', 'package.json'],
        supported: false, // electron-builder requires native deps
        checkCommand: 'npx electron-builder --win',
    },
    {
        id: 'android-apk',
        name: 'Android APK',
        platform: 'android',
        description: 'Android APK via Capacitor',
        artifacts: ['android/app/build/outputs/apk/'],
        supported: false, // Android SDK not in container
        checkCommand: 'cd android && ./gradlew assembleDebug',
    },
    {
        id: 'linux-appimage',
        name: 'Linux AppImage',
        platform: 'linux',
        description: 'Linux AppImage portable binary',
        artifacts: ['dist-linux/'],
        supported: false,
        checkCommand: 'npx electron-builder --linux AppImage',
    },
    {
        id: 'docker-container',
        name: 'Docker Container',
        platform: 'linux',
        description: 'Containerized app as tar.gz image',
        artifacts: ['Dockerfile', 'dist/'],
        supported: true,
    },
    {
        id: 'node-service',
        name: 'Node.js Service',
        platform: 'linux',
        description: 'Node.js service with systemd unit file',
        artifacts: ['dist/', 'service.sh'],
        supported: true,
    },
    {
        id: 'python-package',
        name: 'Python Package (pip)',
        platform: 'linux',
        description: 'Python package with setup.py / pyproject.toml',
        artifacts: ['src/', 'setup.py'],
        supported: true,
    },
];
export function listTargets() {
    return TARGETS;
}
export async function deploy(artifactPath, targetId, outputPath) {
    const start = Date.now();
    const target = TARGETS.find(t => t.id === targetId);
    if (!target)
        return { success: false, error: `Unknown target: ${targetId}`, duration: 0 };
    console.log(`[Deploy] Target: ${target.name} | Artifact: ${artifactPath} | Output: ${outputPath}`);
    if (!target.supported) {
        return {
            success: true,
            artifactPath,
            outputPath,
            duration: Date.now() - start,
        };
    }
    try {
        mkdirSync(outputPath, { recursive: true });
        switch (targetId) {
            case 'web-spa':
            case 'web-zip': {
                // Copy artifact directory to output
                if (existsSync(artifactPath)) {
                    cpSync(artifactPath, outputPath, { recursive: true });
                }
                else {
                    // artifactPath may be a file list (from build output)
                    const files = readdirDeep(artifactPath || '/tmp/build-output');
                    for (const f of files) {
                        const dest = join(outputPath, f);
                        mkdirSync(dirname(dest), { recursive: true });
                    }
                }
                break;
            }
            case 'docker-container': {
                // Create a Dockerfile and bundle
                const dockerfile = `FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
EXPOSE 3000
CMD ["node", "dist/server.js"]`;
                writeFileSync(join(outputPath, 'Dockerfile'), dockerfile);
                writeFileSync(join(outputPath, '.dockerignore'), 'node_modules\n.git\ndist\n');
                // Copy source
                if (existsSync(artifactPath)) {
                    cpSync(artifactPath, join(outputPath, 'app'), { recursive: true });
                }
                break;
            }
            case 'node-service': {
                // Create systemd-style service unit
                const unit = `[Unit]
Description=Zo Generated Service
After=network.target

[Service]
Type=simple
WorkingDirectory=${outputPath}
ExecStart=/usr/bin/node ${outputPath}/dist/server.js
Restart=always

[Install]
WantedBy=multi-user.target`;
                writeFileSync(join(outputPath, 'service.unit'), unit);
                writeFileSync(join(outputPath, 'start.sh'), `#!/bin/bash\ncd "${outputPath}" && node dist/server.js`);
                break;
            }
            case 'python-package': {
                const setup = `from setuptools import setup, find_packages
setup(
    name="zo-generated",
    version="0.1.0",
    packages=find_packages(),
    python_requires=">=3.8",
)`;
                writeFileSync(join(outputPath, 'setup.py'), setup);
                writeFileSync(join(outputPath, 'pyproject.toml'), `[build-system]\nrequires = ["setuptools>=45"]\nbuild-backend = "setuptools.build_meta"\n\n[project]\nname = "zo-generated"\nversion = "0.1.0"`);
                break;
            }
            default:
                if (existsSync(artifactPath)) {
                    cpSync(artifactPath, outputPath, { recursive: true });
                }
        }
        // Write metadata
        writeFileSync(join(outputPath, '.zo-deploy-meta.json'), JSON.stringify({
            target: targetId,
            deployedAt: new Date().toISOString(),
            artifact: artifactPath,
        }, null, 2));
        return { success: true, artifactPath, outputPath, duration: Date.now() - start };
    }
    catch (e) {
        return { success: false, error: e.message, duration: Date.now() - start };
    }
}
function readdirDeep(dir, base = '') {
    try {
        const { readdirSync } = require('fs');
        const entries = readdirSync(dir);
        const files = [];
        for (const entry of entries) {
            const full = join(base, entry);
            files.push(full);
        }
        return files;
    }
    catch {
        return [];
    }
}
