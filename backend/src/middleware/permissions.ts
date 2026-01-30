import {
  Request,
  RequestHandler,
  Response,
  NextFunction,
} from 'express';
import { StatusCodes } from "http-status-codes";
import { User } from "../models/index.js";
import { AppError } from '../utils/errors/index.js'

/**
 * Middleware to check if the user has the required permission.
 * Assumes req.auth.payload is populated by prior authentication middleware (like express-oauth2-jwt-bearer).
 */
export const checkPermissions = (requiredPermission: string, isSelf: boolean = false): RequestHandler => {
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

      try {
        const user = await User.findById(userId).exec();

        // Check if the authenticated user's 'sub' matches the target user's 'sub'
        if (user && user.sub === req.auth?.payload?.sub) {
          return next();
        }
      } catch (error) {
        // Handle database errors (e.g., invalid ID format)
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return next(new AppError(message, StatusCodes.INTERNAL_SERVER_ERROR));
      }
    }
    // Default to Forbidden if no conditions are met
    return next(new AppError('Forbidden: Not Authorized', StatusCodes.FORBIDDEN));
  };
};
