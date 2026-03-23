import {
  Request,
  Response,
  NextFunction,
} from 'express';
import { StatusCodes } from 'http-status-codes';

import { AppError } from '../utils/errors/index.js';
import { TenantModels } from '../types/tenantContext.js';

/**
 * Factory function to create a middleware that fetches a document by ID.
 * Uses Generics <T> to maintain the type of the Mongoose Document.
 */
export const createAttachMiddleware = <K extends keyof TenantModels>(
  modelName: K,
  paramName: string,
  reqPropertyName: string
) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // If the resource was already attached (e.g. by checkPermissions), skip!
    if ((req as any)[reqPropertyName]) {
      return next();
    }

    const itemId: string = req.params[paramName];

    if (!itemId) {
      return next(new AppError(`Missing parameter: ${paramName}`, StatusCodes.BAD_REQUEST));
    }

    const model = req.tenantModels[modelName];

    try {
      const item = await model.findById(itemId).exec();

      if (!item) {
        return next(new AppError(`${String(modelName)} not found`, StatusCodes.NOT_FOUND));
      }

      // Attach the document to the request object
      // We use bracket notation and 'any' cast here because the property name is dynamic
      (req as any)[reqPropertyName] = item;

      next();
    } catch (error: any) {
      // Check for Mongoose CastError (e.g., invalid ObjectId)
      if (error.name === 'CastError') {
        return next(new AppError(`Invalid ${paramName}: ${itemId}`, StatusCodes.BAD_REQUEST));
      }
      // Check if the error is an AppError instance
      if (error instanceof AppError) {
        return next(error);
      }
      // Convert standard errors or Mongoose errors to AppError format
      const message = error instanceof Error ? error.message : 'Internal Server Error';
      next(new AppError(message, StatusCodes.INTERNAL_SERVER_ERROR));
    }
  }
}
