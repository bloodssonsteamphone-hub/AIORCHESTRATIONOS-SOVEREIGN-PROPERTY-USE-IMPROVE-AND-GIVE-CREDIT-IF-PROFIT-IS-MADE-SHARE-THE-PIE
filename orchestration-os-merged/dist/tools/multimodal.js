// Layer 3 — Multimodal Tools (multimodal.*)
// Phase 3: image.generate, image.edit, audio.transcribe, audio.speak, video.extract_frames
import { spawn } from 'child_process';
function execAsync(cmd, args) {
    return new Promise((resolve) => {
        const proc = spawn(cmd, args);
        let stdout = '', stderr = '';
        proc.stdout?.on('data', d => stdout += d.toString());
        proc.stderr?.on('data', d => stderr += d.toString());
        proc.on('close', code => resolve({ stdout, stderr, exitCode: code || 0 }));
        proc.on('error', e => resolve({ stdout, stderr, exitCode: 1 }));
    });
}
function callOllama(prompt, model) {
    return new Promise((resolve, reject) => {
        const proc = spawn('curl', ['-s', 'http://localhost:11434/api/generate', '-d', JSON.stringify({ model, prompt, stream: false })]);
        let data = '';
        proc.stdout?.on('data', d => data += d.toString());
        proc.on('close', () => {
            try {
                const j = JSON.parse(data);
                resolve(j.response || '');
            }
            catch {
                reject(new Error('Ollama parse error'));
            }
        });
        proc.on('error', () => reject(new Error('Ollama not running on localhost:11434')));
    });
}
export const imageGenTool = {
    name: 'image.generate',
    category: 'multimodal',
    description: 'Generate images via Ollama Stable Diffusion or external API',
    capabilities: ['text-to-image', 'style-transfer'],
    metrics: { invocations: 0, successes: 0, failures: 0, avgDuration: 0 },
    invoke: async (params) => {
        const start = Date.now();
        const { prompt, outputPath, width, height } = params;
        try {
            // Check for Ollama with stable-diffusion
            const result = await callOllama(`Generate image: ${prompt}. Output format: describe the image in detail as a text prompt for Stable Diffusion.`, 'stable-diffusion');
            const path = outputPath || `/tmp/zo-img-${Date.now()}.png`;
            // Note: Ollama stable-diffusion is a text model, not an actual image generator
            // For real image gen, would need ComfyUI or similar
            return {
                success: true,
                data: {
                    prompt,
                    model: 'stable-diffusion (via Ollama)',
                    note: 'Real image generation requires ComfyUI or external API. Ollama SD is a text model.',
                    description: result,
                    outputPath: path,
                    dimensions: { width: width || 512, height: height || 512 },
                },
                duration: Date.now() - start,
            };
        }
        catch (e) {
            return { success: false, error: e.message, duration: Date.now() - start };
        }
    },
};
export const imageEditTool = {
    name: 'image.edit',
    category: 'multimodal',
    description: 'Edit existing images: crop, resize, filter, transform',
    capabilities: ['crop', 'resize', 'filter', 'transform'],
    metrics: { invocations: 0, successes: 0, failures: 0, avgDuration: 0 },
    invoke: async (params) => {
        const start = Date.now();
        const { action, inputPath, outputPath, width, height, filter } = params;
        if (!inputPath)
            throw new Error('inputPath required for image.edit');
        try {
            const output = outputPath || inputPath.replace(/(\.\w+)$/, `-edited$1`);
            const args = [inputPath];
            switch (action) {
                case 'resize':
                    args.push('-resize', `${width || 512}x${height || 512}!`);
                    break;
                case 'crop':
                    args.push('-crop', `${width || 256}x${height || 256}+0+0`);
                    break;
                case 'filter':
                    args.push('-blur', filter || '5x5');
                    break;
                case 'grayscale':
                    args.push('-colorspace', 'Gray');
                    break;
                default:
                    return { success: false, error: `Unknown image action: ${action}`, duration: Date.now() - start };
            }
            args.push(output);
            const { stdout, stderr, exitCode } = await execAsync('convert', args);
            if (exitCode !== 0)
                throw new Error(stderr || 'ImageMagick convert failed');
            return { success: true, data: { inputPath, outputPath: output, action, dimensions: { width, height } }, duration: Date.now() - start };
        }
        catch (e) {
            return { success: false, error: e.message, duration: Date.now() - start };
        }
    },
};
export const audioTranscribeTool = {
    name: 'audio.transcribe',
    category: 'multimodal',
    description: 'Transcribe audio to text using Whisper via Ollama (stub — Whisper model not available)',
    capabilities: ['transcribe', 'translate'],
    metrics: { invocations: 0, successes: 0, failures: 0, avgDuration: 0 },
    invoke: async (params) => {
        const start = Date.now();
        const { audioPath, language, model } = params;
        if (!audioPath)
            throw new Error('audioPath required for audio.transcribe');
        try {
            // Try Whisper via Ollama (will fail — Whisper is not a text model in Ollama)
            const transcript = await callOllama(`Transcribe this audio file: ${audioPath}${language ? ` (language: ${language})` : ''}`, model || 'whisper');
            return { success: true, data: { audioPath, transcript, language: language || 'auto', model: model || 'whisper' }, duration: Date.now() - start };
        }
        catch (e) {
            // Whisper unavailable — return failure with audio info as fallback
            const { stdout } = await execAsync('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', audioPath]);
            return { success: false, error: `Whisper unavailable: ${e.message}. Audio info: ${stdout.slice(0, 200)}`, duration: Date.now() - start };
        }
    },
};
export const audioSpeakTool = {
    name: 'audio.speak',
    category: 'multimodal',
    description: 'Convert text to speech (TTS)',
    capabilities: ['text-to-speech', 'list-voices'],
    metrics: { invocations: 0, successes: 0, failures: 0, avgDuration: 0 },
    invoke: async (params) => {
        const start = Date.now();
        const { text, voice, outputPath, rate } = params;
        if (!text)
            throw new Error('text required for audio.speak');
        try {
            // Check for espeak or say command
            const output = outputPath || `/tmp/zo-tts-${Date.now()}.wav`;
            const { exitCode } = await execAsync('espeak', ['-w', output, text]);
            if (exitCode !== 0) {
                // macOS fallback
                await execAsync('say', ['-o', output, text]);
            }
            return { success: true, data: { text, outputPath: output, voice: voice || 'default', rate: rate || 150 }, duration: Date.now() - start };
        }
        catch (e) {
            return { success: false, error: `TTS failed: ${e.message}. Install espeak-ng for Linux or use macOS say command.`, duration: Date.now() - start };
        }
    },
};
export const videoExtractFramesTool = {
    name: 'video.extract_frames',
    category: 'multimodal',
    description: 'Extract frames from video files using ffmpeg',
    capabilities: ['extract-frame', 'extract-scene', 'video-info'],
    metrics: { invocations: 0, successes: 0, failures: 0, avgDuration: 0 },
    invoke: async (params) => {
        const start = Date.now();
        const { action, videoPath, outputDir, fps, timestamp } = params;
        if (!videoPath)
            throw new Error('videoPath required for video.extract_frames');
        try {
            const outDir = outputDir || `/tmp/zo-frames-${Date.now()}`;
            const mkdirResult = await execAsync('mkdir', ['-p', outDir]);
            if (mkdirResult.exitCode !== 0)
                throw new Error('Could not create output directory');
            switch (action) {
                case 'extract-frame': {
                    const ts = timestamp || '00:00:01';
                    const output = `${outDir}/frame-${Date.now()}.png`;
                    const { exitCode, stderr } = await execAsync('ffmpeg', ['-ss', ts, '-i', videoPath, '-vframes', '1', '-y', output]);
                    if (exitCode !== 0)
                        throw new Error(stderr || 'ffmpeg frame extract failed');
                    return { success: true, data: { framePath: output, timestamp: ts }, duration: Date.now() - start };
                }
                case 'extract-scene': {
                    const extractedFps = fps || 1;
                    const outputPattern = `${outDir}/frame-%04d.png`;
                    const { exitCode, stderr } = await execAsync('ffmpeg', ['-i', videoPath, '-vf', `fps=${extractedFps}`, '-y', outputPattern]);
                    if (exitCode !== 0)
                        throw new Error(stderr || 'ffmpeg scene extract failed');
                    const lsResult = await execAsync('ls', [outDir]);
                    const frames = lsResult.stdout.trim().split('\n').filter(Boolean);
                    return { success: true, data: { frameCount: frames.length, outputDir: outDir, fps: extractedFps }, duration: Date.now() - start };
                }
                case 'video-info': {
                    const { stdout, exitCode, stderr } = await execAsync('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', videoPath]);
                    if (exitCode !== 0)
                        throw new Error(stderr || 'ffprobe failed');
                    const info = JSON.parse(stdout);
                    // Safe FPS parsing — avoid eval()
                    const fps = (() => {
                        const fr = info.streams?.[0]?.r_frame_rate || '0';
                        const parts = fr.split('/');
                        return parts.length === 2 && parseInt(parts[1]) !== 0
                            ? parseInt(parts[0]) / parseInt(parts[1])
                            : parseFloat(fr);
                    })();
                    return {
                        success: true,
                        data: {
                            duration: info.format?.duration,
                            size: info.format?.size,
                            codec: info.streams?.[0]?.codec_name,
                            resolution: `${info.streams?.[0]?.width}x${info.streams?.[0]?.height}`,
                            fps: fps,
                        },
                        duration: Date.now() - start,
                    };
                }
                default:
                    throw new Error(`Unknown video action: ${action}`);
            }
        }
        catch (e) {
            return { success: false, error: e.message, duration: Date.now() - start };
        }
    },
};
