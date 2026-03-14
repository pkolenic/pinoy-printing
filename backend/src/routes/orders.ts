import { Router } from 'express';
import { createRouteGuards } from "../utils/routeGuards.js";
import {
  createOrder,
} from '../controllers/orders.js';
import {
  createOrderRules,
} from "../middleware/index.js";

//Define allowed permission strings
type OrderPermission =
  | 'read:orders'
  | 'create:orders'
  | 'update:orders'
  | 'delete:orders'
  | 'self'; // Placeholder for self-only logic

// ROUTE GUARDS
const { guard, guardedResource, guardedMultiResource } = createRouteGuards<OrderPermission, 'User'>('User', 'userId', 'user');

// Define a Router instance
export const router = Router();

// ROUTES
router.get('/', guard('read:orders'), /*TODO - getOrders*/);

router.route('/:userId')
  .post(guardedResource('create:orders', createOrderRules, true), createOrder);

// USER ORDER ROUTES
const orderRouter = Router({ mergeParams: true });
orderRouter.route('/:orderId')
  .get(guardedMultiResource('read:orders', [
      { modelName: 'User', param: 'userId', key: 'user' },
      { modelName: 'Order', param: 'orderId', key: 'order' }
    ], [/* no validation rules */], true),
    /* getOrder */
  )
  .delete(guardedMultiResource('delete:orders', [
      { modelName: 'User', param: 'userId', key: 'user' },
      { modelName: 'Order', param: 'orderId', key: 'order' }
    ], [/* no validation rules */]),
    /* deleteOrder */)
  .put(guardedMultiResource('update:orders', [
      { modelName: 'User', param: 'userId', key: 'user' },
      { modelName: 'Order', param: 'orderId', key: 'order' }
    ], [/* TODO updateOrderRules */], true),
    /* updateOrder */)

router.use('/:userId/order', orderRouter);

// Export the router
export default router;
