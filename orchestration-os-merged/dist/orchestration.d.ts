import { type Session } from './agents.js';
export declare function createSession(idea: string): Session;
export declare function getSession(id: string): Session | undefined;
export declare function runBuild(sessionId: string): Promise<Session>;
export declare function getSystemStatus(): {
    sessions: number;
    uptime: number;
    memory: number;
    timestamp: number;
};
