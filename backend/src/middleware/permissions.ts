import {
  Request,
  RequestHandler,
  Response,
  NextFunction,
} from 'express';
import { User } from "../models/index.js";

/**
 * Middleware to check if the user has the required permission.
 * Assumes req.auth.payload is populated by prior authentication middleware (like express-oauth2-jwt-bearer).
 */
export const checkPermissions = (requiredPermission: string, isSelf: boolean = false): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userPermissions: string[] = req.auth?.payload.permissions || [];

    if (userPermissions.includes(requiredPermission)) {
      return next(); // User has explicit permission, continue to the next handler
    }

    if (isSelf) {
      const {userId} = req.params;

      try {
        const user = await User.findById(userId).exec();

        // Check if the authenticated user's 'sub' matches the target user's 'sub'
        if (user && user.sub === req.auth?.payload?.sub) {
          return next();
        }
      } catch (error) {
        // Handle database errors (e.g., invalid ID format)
        res.status(500).json({error: 'Internal Server Error'});
        return;
      }

      // Default to Forbidden if no conditions are met
      res.status(403).json({error: 'Forbidden: Not Authorized'});
    }
  };
};
