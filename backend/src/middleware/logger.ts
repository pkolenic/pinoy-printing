import { RequestHandler } from 'express';
import { logger } from '../utils/logging/index.js';

export const loggerMiddleware: RequestHandler = (req, _res, next) => {
  const method = req.method;
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

  // Dynamically pull the color from the Logger Singleton's color map
  const color = logger.colors[method as keyof typeof logger.colors] || 'white';

  logger.info({
    message: `${method} ${url}`,
    color
  });

  next();
};
