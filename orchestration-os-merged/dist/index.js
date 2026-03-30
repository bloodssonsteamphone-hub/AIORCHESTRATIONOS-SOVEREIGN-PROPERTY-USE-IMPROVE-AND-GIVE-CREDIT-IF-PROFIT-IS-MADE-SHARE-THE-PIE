// Entry Point
import app from './server.js';
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Zo Orchestration OS v3.0.0 ready on port ${PORT}`);
});
export default app;
