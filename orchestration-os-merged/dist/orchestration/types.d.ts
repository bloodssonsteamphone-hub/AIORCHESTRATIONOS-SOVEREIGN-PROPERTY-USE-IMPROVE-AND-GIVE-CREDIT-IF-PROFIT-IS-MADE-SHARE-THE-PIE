export interface BuildFile {
    path: string;
    content: string;
}
export interface BuildSession {
    id: string;
    prompt: string;
    status: 'pending' | 'building' | 'success' | 'failed';
    files?: BuildFile[];
    error?: string;
    createdAt: number;
    duration?: number;
    provider?: string;
    model?: string;
}
export interface BuildResult {
    success: boolean;
    files?: BuildFile[];
    error?: string;
    provider?: string;
    model?: string;
    duration: number;
}
