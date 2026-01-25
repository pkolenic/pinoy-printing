import {
  ErrorRequestHandler,
  RequestHandler,
} from 'express';
import { AppError } from '../utils/errors/index.js';
import { logger } from '../utils/logging/index.js';

/**
 * Middleware to catch Application errors
 * This should be placed after all defined routes.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // Determine the status code, If it's an AppError, we know it has a .status property
  let status = 500;
  let message = err.message || 'Internal Server Error';

  if (err instanceof AppError) {
    status = err.status;
  } else if (err && typeof err === 'object' && ('status' in err || 'statusCode' in err)) {
    // Safely checking for property existence on third-party errors from other libraries (like express-jwt or mongoose)
    status = (err as any).status || (err as any).statusCode || 500;
  }

  logger.error({ message: `${req.method} ${req.originalUrl} - Status: ${status}`, args: [err] })

  // Send the response
  res.status(status).json({ success: false, message });
};

/**
 * Middleware to catch 404 errors for routes that don't exist.
 * This should be placed after all defined routes.
 */
export const notFoundHandler: RequestHandler = (req, res, next) => {
  const error = new AppError(`Not Found - ${req.originalUrl}`, 404);
  next(error);
}
