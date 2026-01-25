import { Router, RequestHandler } from 'express';

import {
  createOrder,
} from '../controllers/orders.js';
import {
  checkPermissions,
  createAttachMiddleware,
  attachAddress,
  jwtCheck,
} from "../middleware/index.js";

import {
  Order,
  User
} from '../models/index.js';

// 'attachOrder' is a RequestHandler that attaches the order document to the request object
const attachOrder: RequestHandler = createAttachMiddleware(Order, 'orderId', 'order');

// 'attachUser' is a RequestHandler that attaches the user document to the request object
const attachUser: RequestHandler = createAttachMiddleware(User, 'userId', 'user');

// Define a Router instance
export const router: Router = Router();

/**
 * Global User Middleware
 * Protects all routes mounted below this line with JWT verification.
 */
router.use(jwtCheck);

/**
 * Create a new order for a user
 * Permissions: self (the target user)
 */
router.post('/:userId/create',
  checkPermissions('self', true),  // Uses 'self' as a placeholder for logic
  attachUser,
  attachAddress,
  createOrder,
);

/**
 * Get a specific order for a user
 * Permissions: read:orders OR isSelf (the target user)
 */
router.get('/:userId/order/:orderId',
  checkPermissions('read:orders', true),
  attachOrder,
  attachUser,
  // TODO - getOrder
)

/**
 * Get all orders
 * Permissions: read:orders
 */
router.get('/',
  checkPermissions('read:orders'),
  // TODO - getOrders,
)

// Export the router
export default router;
