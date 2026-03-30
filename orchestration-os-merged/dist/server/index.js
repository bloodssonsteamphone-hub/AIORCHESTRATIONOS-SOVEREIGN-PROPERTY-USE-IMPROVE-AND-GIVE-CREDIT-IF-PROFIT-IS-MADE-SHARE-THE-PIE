// Express Server
import express from 'express';
import { createSession, getSession, runBuild, getSystemStatus } from '../orchestration.js';
const app = express();
app.use(express.json());
app.get('/health', (_, res) => res.json({ status: 'ok', ts: Date.now() }));
app.get('/status', (_, res) => res.json(getSystemStatus()));
app.post('/build', async (req, res) => {
    try {
        const { idea } = req.body;
        if (!idea)
            return res.status(400).json({ error: 'Missing idea' });
        const session = createSession(idea);
        console.log(`[API] Session ${session.id}: ${idea.slice(0, 50)}...`);
        runBuild(session.id).catch(e => console.log(`[API] Build error: ${e}`));
        res.json({ sessionId: session.id, status: session.status });
    }
    catch (e) {
        res.status(500).json({ error: String(e) });
    }
});
app.get('/session/:id', (req, res) => {
    const s = getSession(req.params.id);
    if (!s)
        return res.status(404).json({ error: 'Not found' });
    res.json(s);
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[Server] Port ${PORT}`));
export default app;
