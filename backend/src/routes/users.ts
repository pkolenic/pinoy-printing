import { Router, RequestHandler } from 'express';

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
  checkPermissions,
  createAttachMiddleware,
  jwtCheck,
  createUserRules,
  updateUserRules,
  updatePasswordRules,
  validate,
} from "../middleware/index.js";

import { User } from '../models/index.js';

// 'attachUser' is a RequestHandler that attaches the user document to the request object
const attachUser: RequestHandler = createAttachMiddleware(User, 'userId', 'user');

// Define a Router instance
const router: Router = Router();

/**
 * Global User Middleware
 * Protects all routes mounted below this line with JWT verification.
 */
router.use(jwtCheck);

/**
 * GET users listing.
 * Permissions: read:users
 */
router.get('/',
  checkPermissions('read:users'),
  getUsers,
);

/**
 * Get a specific user
 * Permissions: read:users OR isSelf (the target user)
 */
router.get('/:userId',
  checkPermissions('read:users', true),
  attachUser,
  getUser,
);

/**
 * Create a new user
 * Permissions: create:users
 */
router.post('/',
  checkPermissions('create:users'),
  createUserRules,
  validate,
  createUser,
);

/**
 * Address Management Routes
 * Uses isSelf logic (true) to allow users to manager their own addresses
 */
router.post('/:userId/address/create',
  checkPermissions('create:addresses', true),
  attachUser,
  createAddress,
)

router.delete('/:userId/address/:addressId',
  checkPermissions('delete:addresses', true),
  attachUser,
  deleteAddress,
)

router.put('/:userId/address/:addressId',
  checkPermissions('update:addresses', true),
  attachUser,
  updateAddress,
)

/**
 * Delete a specific user
 * Permissions: delete:user
 */
router.delete('/:userId',
  checkPermissions('delete:users'),
  attachUser,
  deleteUser,
);

/**
 * Update a specific user
 * Permissions: update:users OR isSelf (the target user)
 */
router.put('/:userId',
  checkPermissions('update:users', true),
  updateUserRules,
  validate,
  attachUser,
  updateUser,
);

/**
 * Update a user's password
 * Permissions: self (the target user)
 */
router.put('/:userId/password',
  checkPermissions('self', true),  // Uses 'self' as a placeholder for logic
  updatePasswordRules,
  validate,
  attachUser,
  updateUserPassword,
);

// Export the router
export default router;
