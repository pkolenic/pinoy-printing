import { Router } from 'express';
import { createRouteGuards } from "../utils/routeGuards.js";
import {
  createUser,
  deleteUser,
  getUsers,
  getUser,
  updateUser,
  updateUserPassword,
  createAddress,
  deleteAddress,
  updateAddress,
} from '../controllers/users.js';
import {
  createUserRules,
  updateUserRules,
  updatePasswordRules,
} from "../middleware/index.js";

import { User } from '../models/index.js';

//Define allowed permission strings
type UserPermission =
  | 'read:users'
  | 'create:users'
  | 'update:users'
  | 'delete:users'
  | 'create:addresses'
  | 'update:addresses'
  | 'delete:addresses'
  | 'self'; // Placeholder for self-only logic

// ROUTE GUARDS
const { guard, guardedResource } = createRouteGuards<UserPermission>(User, 'userId', 'user');

// Define a Router instance
const router: Router = Router();

// USER ROUTES
router.get('/', guard('read:users'), getUsers);
router.post('/', guard('create:users', createUserRules), createUser);
router.route('/:userId')
  .get(guardedResource('read:users', [], true), getUser)
  .delete(guardedResource('delete:users'), deleteUser)
  .put(guardedResource('update:users', updateUserRules), updateUser)
router.put('/:userId/password',
  guardedResource('self', updatePasswordRules, true),
  updateUserPassword,
);

// ADDRESS ROUTES
const addressRouter = Router({ mergeParams: true });
addressRouter.post('/', guardedResource('create:addresses', [], true), createAddress);
addressRouter.route('/:addressId')
  .put(guardedResource('update:addresses', [], true), updateAddress)
  .delete(guardedResource('delete:addresses', [], true), deleteAddress);
router.use('/:userId/address', addressRouter);

// Export the router
export default router;
