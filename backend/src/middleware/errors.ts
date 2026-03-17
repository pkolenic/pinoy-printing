import {
  ErrorRequestHandler,
  RequestHandler,
} from 'express';
import { StatusCodes } from "http-status-codes";
import { AppError } from '../utils/errors/index.js';
import { logger } from '../utils/logging/index.js';

/**
 * Middleware to catch Application errors
 * This should be placed after all defined routes.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res) => {
  // Determine the status code, If it's an AppError, we know it has a .statusCode property
  let statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
  let message = err.message || 'Internal Server Error';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
  } else if (err && typeof err === 'object' && ('status' in err || 'statusCode' in err)) {
    // Safely checking for property existence on third-party errors from other libraries (like express-jwt or mongoose)
    statusCode = (err as any).status || (err as any).statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  }

  const { method, protocol, originalUrl } = req;
  const host = req.get('host');
  const url = `${protocol}://${host}${originalUrl}`;

  logger.error({
    message: `${method}[${statusCode}] ${url}`,
    tenantId: req?.tenantConfig?.tenantId || 'system',
    args: [err]
  })

  // Send the response
  res.status(statusCode).json({ success: false, message });
};

/**
 * Middleware to catch 404 errors for routes that don't exist.
 * This should be placed after all defined routes.
 */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  const error = new AppError(`Not Found - ${req.originalUrl}`, StatusCodes.NOT_FOUND);
  next(error);
}
