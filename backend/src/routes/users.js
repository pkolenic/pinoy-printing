import express from 'express';
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
import jwtCheck from "../middleware/auth.js";
import checkPermissions from "../middleware/checkPermissions.js";
import createAttachMiddleware from "../middleware/models.js";

import { User } from '../models/index.js';

const attachUser = createAttachMiddleware(User, 'userId', 'user');
const router = express.Router();
router.use(jwtCheck);

/* GET users listing. */
router.get('/',
  checkPermissions('read:users'),
  getUsers,
)

/* Get a specific user */
router.get('/:userId',
  checkPermissions('read:users', true),
  attachUser,
  getUser,
)

/* Create a new user */
router.post('/',
  checkPermissions('create:users'),
  createUser,
);

/* Create a new address for a user */
router.post('/:userId/address/create',
  checkPermissions('create:addresses', true),
  attachUser,
  createAddress,
)

/* Delete an address for a user */
router.delete('/:userId/address/:addressId',
  checkPermissions('delete:addresses', true),
  attachUser,
  deleteAddress,
)

/* Update an address for a user */
router.put('/:userId/address/:addressId',
  checkPermissions('update:addresses', true),
  attachUser,
  updateAddress,
)

/* Delete a user */
router.delete('/:userId',
  checkPermissions('delete:users'),
  attachUser,
  deleteUser,
);

/* Update a user */
router.put('/:userId',
  checkPermissions('update:users', true),
  attachUser,
  updateUser,
);

router.put('/:userId/password',
  checkPermissions('self', true),
  attachUser,
  updateUserPassword,
);

// Export the router
export default router;
