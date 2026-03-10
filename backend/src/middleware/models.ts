import { RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';

import { AppError } from '../utils/errors/index.js';
import { AddressSubdocument } from '../models/index.js';
import { TenantModels } from '../types/tenantContext.js';

/**
 * Factory function to create a middleware that fetches a document by ID.
 * Uses Generics <T> to maintain the type of the Mongoose Document.
 */
export const createAttachMiddleware = <K extends keyof TenantModels>(
  modelName: K,
  paramName: string,
  reqPropertyName: string
): RequestHandler => {
  return async (req, _res, next) => {
    const itemId: string = req.params[paramName];
    const model = req.tenantModels[modelName];

    try {
      const item = await model.findById(itemId).exec();

      if (!item) {
        return next(new AppError(`${String(modelName)} not found`, StatusCodes.NO_CONTENT));
      }

      // Attach the document to the request object
      // We use bracket notation and 'any' cast here because the property name is dynamic
      (req as any)[reqPropertyName] = item;

      next();
    } catch (error: unknown) {
      if (error instanceof AppError) {
        return next(error);
      }
      // Convert standard errors or Mongoose errors to AppError format
      const message = error instanceof Error ? error.message : 'Internal Server Error';
      next(new AppError(message, StatusCodes.INTERNAL_SERVER_ERROR));
    }
  }
}

/**
 * Middleware to find a specific address from the attached user
 * and attach it to the request for the next handler.
 */
export const attachAddress: RequestHandler = (req, res, next) => {
  const { user } = req;

  // Look for addressId in body (POST) or query (GET)
  const addressId = req.body.addressId || req.query.addressId;

  if (!user) {
    return next(new AppError('User context required to attach address', StatusCodes.INTERNAL_SERVER_ERROR));
  }

  // If an addressId was provided, find it in the user's subdocuments
  if (addressId) {
    const foundAddress = user.addresses.id(addressId) as AddressSubdocument | null;

    if (!foundAddress) {
      return next(new AppError('The specified address was not found', StatusCodes.NO_CONTENT));
    }

    // Attach to the request for the controller to use
    req.address = foundAddress;
  }

  next();
};
