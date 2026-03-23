import { Router } from 'express';
import { createRouteGuards } from "../utils/routeGuards.js";
import {
  createOrder,
  getOrder,
  getOrders,
  deleteOrder,
  updateOrder,
  getUserOrders,
} from '../controllers/orders.js';
import {
  createOrderRules,
  updateOrderRules,
} from "../middleware/index.js";
import { mountRoute } from '../utils/routes.js';

//Define allowed permission strings
type OrderPermission =
  | 'read:orders'
  | 'create:orders'
  | 'update:orders'
  | 'delete:orders'
  | 'self'; // Placeholder for self-only logic

// ROUTE GUARDS
const { guard, guardedResource, guardedRelationship } = createRouteGuards<OrderPermission, 'Order'>('Order', 'orderId', 'order');

// Define a Router instance
const router = Router();

// ADMIN ROUTES
router.get('/', guard('read:orders'), getOrders);

router.route('/:orderId')
  .get(guardedResource('read:orders'), getOrder)
  .put(guardedResource('update:orders', updateOrderRules), updateOrder)
  .delete(guardedResource('delete:orders'), deleteOrder);

// --- USER-CENTRIC SUB-ROUTER ---
const userOrderRouter = Router({ mergeParams: true });

// Get /user/:userId/orders
userOrderRouter.get('/',
  guard('read:orders', [], true),
  getUserOrders
);

// POST /user/:userId/orders - Create my order
userOrderRouter.post('/',
  guard('create:orders', createOrderRules, true),
  createOrder
);

// GET /user/:userId/orders/:orderId - My specific order
userOrderRouter.get('/:orderId',
  guardedRelationship('read:orders', 'userId', [], true),
  getOrder
);

// PUT /user/:userId/orders/:orderId - Update my order (if siteConfig allows)
userOrderRouter.put('/:orderId',
  guardedRelationship('update:orders', 'userId', updateOrderRules, true),
  updateOrder
);

mountRoute(router, '/user/:userId/orders', userOrderRouter);

// Export the router
export default router;
