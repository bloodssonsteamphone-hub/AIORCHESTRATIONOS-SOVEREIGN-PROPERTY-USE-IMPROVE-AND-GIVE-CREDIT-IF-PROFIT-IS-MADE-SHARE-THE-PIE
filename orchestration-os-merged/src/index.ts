// Entry Point — ESM
import app from './server.js';
import { initOrchestrator } from './orchestration/index.js';

const PORT = process.env.PORT || 3000;

// Initialize orchestrator
initOrchestrator();

app.listen(PORT, () => {
  console.log(`🚀 Zo Orchestration OS v3.2.0 ready on port ${PORT}`);
});

export default app;
