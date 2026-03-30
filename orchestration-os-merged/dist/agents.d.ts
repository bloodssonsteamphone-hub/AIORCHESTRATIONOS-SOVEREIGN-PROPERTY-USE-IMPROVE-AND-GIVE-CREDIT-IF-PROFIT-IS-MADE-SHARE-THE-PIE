export interface Session {
    id: string;
    idea: string;
    files: FileOutput[];
    status: 'pending' | 'running' | 'success' | 'failure';
    error?: string;
    duration?: number;
    retries: number;
    createdAt: number;
}
export interface FileOutput {
    path: string;
    content: string;
}
export declare function planner(session: Session): Promise<{
    plan: string;
    files: any[];
}>;
export declare function generator(session: Session, fileSpec: any): Promise<FileOutput>;
export declare function writeFiles(files: FileOutput[], basePath: string): number;
