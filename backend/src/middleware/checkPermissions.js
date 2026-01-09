import createAttachMiddleware from "./models.js";
import User from "../models/User.js";

/**
 * Middleware to check if the user has the required permission.
 * Assumes req.auth.payload is populated by a prior authentication middleware (like express-oauth2-jwt-bearer).
 */
const checkPermissions = (requiredPermission, isSelf = false) => {
  return async (req, res, next) => {
    const userPermissions = req.auth.payload.permissions || [];

    if (userPermissions.includes(requiredPermission)) {
      next(); // User has permission, continue to the next handler
    } else if (isSelf) {
      const userId = req.params.userId;
      const user = await User.findById(userId).exec();
      if (user && user.sub === req.auth.payload.sub) {
        next();
      } else {
        // Forbidden error
        res.status(403).json({ error: 'Forbidden: Not Authorized' });
      }
    } else {
      // Forbidden error
      res.status(403).json({ error: 'Forbidden: Not Authorized' });
    }
  };
};

export default checkPermissions;
