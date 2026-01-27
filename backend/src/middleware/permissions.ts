import {
  Request,
  RequestHandler,
  Response,
  NextFunction,
} from 'express';
import { StatusCodes } from "http-status-codes";
import { User } from "../models/index.js";

/**
 * Middleware to check if the user has the required permission.
 * Assumes req.auth.payload is populated by prior authentication middleware (like express-oauth2-jwt-bearer).
 */
export const checkPermissions = (requiredPermission: string, isSelf: boolean = false): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Internal Server Error' });
        return;
      }
    }
    // Default to Forbidden if no conditions are met
    res.status(StatusCodes.FORBIDDEN).json({ error: 'Forbidden: Not Authorized' });
  };
};
