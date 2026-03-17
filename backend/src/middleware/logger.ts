import { RequestHandler } from 'express';
import { logger } from '../utils/logging/index.js';

export const loggerMiddleware: RequestHandler = (req, res, next) => {
  // We register a listener for when the response is sent back to the client
  res.on('finish', () => {
    const { method, protocol, originalUrl } = req;
    const host = req.get('host');
    const statusCode = res.statusCode;
    const url = `${protocol}://${host}${originalUrl}`;

    // Dynamically pull the color from the Logger Singleton's color map
    const color = logger.colors[method as keyof typeof logger.colors] || 'white';

    logger.info({
      message: `${method}[${statusCode}] ${url}`,
      tenantId: req?.tenantConfig?.tenantId || 'system',
      color
    });
  });

  next();
};
