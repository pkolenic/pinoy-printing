import {
  Request,
  Response,
  NextFunction,
} from 'express';
import { StatusCodes } from "http-status-codes";
import { AppError } from '../utils/errors/index.js'

/**
 * Middleware to check if the user has the required permission.
 * Assumes req.auth.payload is populated by prior authentication middleware (like express-oauth2-jwt-bearer).
 */
export const checkPermissions = (requiredPermission: string, isSelf: boolean = false) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // If no permission is required, immediately skip to the next middleware
    if (!requiredPermission) {
      return next();
    }

    const userPermissions: string[] = req.auth?.payload.permissions || [];

    // Check explicit permission
    if (userPermissions.includes(requiredPermission)) {
      return next();
    }

    // Check the "isSelf" condition if applicable
    if (isSelf) {
      const { userId } = req.params;

      if (!userId) {
        return next(new AppError('User ID missing', StatusCodes.BAD_REQUEST));
      }

      try {
        const { User } = req.tenantModels;
        const user = await User.findById(userId).exec();

        // Check if the authenticated user's 'sub' matches the target user's 'sub'
        if (user && user.sub === req.auth?.payload?.sub) {
          // Attach the user so createAttachMiddleware can skip later
          req.user = user;
          return next();
        }
      } catch (error: any) {
        if (error.name === 'CastError') {
          return next(new AppError(`Invalid User ID format`, StatusCodes.BAD_REQUEST));
        }
        // Handle database errors (e.g., invalid ID format)
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return next(new AppError(message, StatusCodes.INTERNAL_SERVER_ERROR));
      }
    }
    // Default to Forbidden if no conditions are met
    return next(new AppError('Forbidden: Not Authorized', StatusCodes.FORBIDDEN));
  };
};

/**
 * Ensures a resource on req[resourceKey] has a field that matches a value in req.params[paramName].
 * Example: verifyRelationship('order', 'userId', 'userId')
 * checks if req.order.userId === req.params.userId
 */
export const verifyRelationship = (
  resourceKey: string,
  resourceField: string,
  paramName: string
) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const resource = (req as any)[resourceKey];
    const paramValue = req.params[paramName];

    if (!resource) {
      return next(new AppError(`${resourceKey} not found`, StatusCodes.NOT_FOUND));
    }

    // Check if the resource's owner field matches the ID in the URL
    // We convert to string to handle Mongoose ObjectIDs vs Strings
    if (String(resource[resourceField]) !== String(paramValue)) {
      return next(new AppError(`Forbidden: This ${resourceKey} does not belong to this user.`, StatusCodes.FORBIDDEN));
    }

    next();
  };
};
