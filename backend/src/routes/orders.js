import express from 'express';
import {
  createOrder,
} from '../controllers/orders.js';
import jwtCheck from "../middleware/auth.js";
import checkPermissions from "../middleware/checkPermissions.js";
import createAttachMiddleware from "../middleware/models.js";
import Order from '../models/Order.js';
import User from "../models/User.js";

const attachOrder = createAttachMiddleware(Order, 'orderId', 'order');
const attachUser = createAttachMiddleware(User, 'userId', 'user');
const router = express.Router();
router.use(jwtCheck);

router.post('/:userId',
  // checkPermissions('create:orders', true),  // TODO: should we allow admins to create orders for a user?
  attachUser,
  createOrder,
);

// Export the router
export default router;
