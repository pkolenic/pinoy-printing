import express, { Application } from 'express';
import { Server } from 'http';

import { connectDB, disconnectDB } from './services/db.js';
import {
  errorHandler,
  loggerMiddleware as logger,
  notFoundHandler,
} from "./middleware/index.js";

import redis from './services/redis.js';
import routes from './routes.js';
import { logger as systemLogger } from './utils/logging/index.js';

// CONFIGURATION
const PORT: number = Number(process.env.PORT) || 3001;

// INITIALIZATION
try {
  // Concurrent startup for performance
  await Promise.all([
    connectDB(),
    redis.connect()
  ]);
} catch (err) {
  systemLogger.error({
    message: 'Initialization failed',
    args: [err],
  })
  process.exit(1);
}

// CREATE EXPRESS SERVER
const app: Application = express();

// Trust Proxy settings
if (process.env.NODE_ENV === 'development') {
  // In dev, trust the Vite proxy so req.hostname works
  app.set('trust proxy', true);
} else {
  // In production, trust only your real reverse proxy (e.g., Nginx, Cloudflare, ELB)
  // '1' means trust the first hop (the proxy directly in front of Node)
  app.set('trust proxy', 1);
}

// MIDDLEWARE
app.use(express.json()); // Body Parser Middleware
app.use(express.urlencoded({extended: false}));
app.use(logger);

// ROUTES
app.use(routes);

// ERROR HANDLING (Must be after routes)
app.use(notFoundHandler);
app.use(errorHandler);

// START SERVER
const server: Server = app.listen(PORT, (): void => {
  systemLogger.info({
    message: `Server is running on port ${PORT}`,
    color: systemLogger.colors.SUCCESS,
  });
});

// Graceful shutdown
let shuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  systemLogger.info({
    message: `\n${signal} received. Gracefully shutting down...`,
    color: systemLogger.colors.SYSTEM_STATE_CHANGE,
  })

  // 1) Stop accepting new HTTP connections
  server.close(async (err?: Error): Promise<void> => {
    if (err) {
      systemLogger.error({ message: 'Error during HTTP server close:', args: [err]});
    }
    systemLogger.info({ message: 'HTTP server closed', color: systemLogger.colors.SYSTEM_INFO});

    try {
      // 2) Close external services concurrently
      await Promise.all([redis.close(), disconnectDB()]);
      systemLogger.info({ message: 'Resource cleanup successful', color: systemLogger.colors.SUCCESS });
    } catch (err) {
      systemLogger.error({ message: 'Error during resource cleanup:', args: [err]});
    } finally {
      process.exit(0);
    }
  });

  // Fallback: force-exit after 5 seconds
  setTimeout(() => {
    systemLogger.info({ message: 'Force exiting after timeout', color: systemLogger.colors.ERROR});
    process.exit(1);
  }, 5000);
}

(['SIGINT', 'SIGTERM'] as const).forEach((sig: string): void => {
  process.on(sig, () => gracefulShutdown(sig));
});
