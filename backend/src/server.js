import express from 'express';

import {connectDB, disconnectDB} from './services/db.js';
import redis from './services/redis.js';
import routes from './routes.js';

// CONFIGURATION
const PORT = process.env.PORT || 3001;

// INITIALIZATION
await connectDB();
await redis.connect();

// CREATE EXPRESS SERVER
const app = express();

// MIDDLEWARE

// ROUTES
app.use(routes);

// ERROR HANDLERS

// START SERVER
const server = app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

// Graceful shutdown
let shuttingDown = false;

async function gracefulShutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${signal} received. Gracefully shutting down...`);

    // 1) Stop accepting new connections
    await new Promise((resolve) => server.close(resolve));
    console.log('HTTP server closed');

    // 2) Close Redis connection
    await redis.quit();

    // 3) Close MongoDB connection
    await disconnectDB();

    // 4) Fallback: force-exit if something hangs (optional)
    const timeout = setTimeout(() => {
        console.warn('Force exiting after timeout');
        process.exit(0);
    }, 2000);
    // If the event loop is clean, this won’t run.
    clearTimeout(timeout);
    process.exit(0);
}

['SIGINT', 'SIGTERM'].forEach((sig) => {
    process.on(sig, () => gracefulShutdown(sig));
});
