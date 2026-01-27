import { Router, RequestHandler } from 'express';

import {
  createCategory,
  deleteCategory,
  getCategories,
  getCategoryTree,
  updateCategory,
} from '../controllers/categories.js'
import {
  checkPermissions,
  createAttachMiddleware,
  createCategoryRules,
  updateCategoryRules,
  jwtCheck,
  validate,
} from "../middleware/index.js";

import { Category } from '../models/index.js';

const attachCategory: RequestHandler = createAttachMiddleware(Category, 'categoryId', 'category');

// Define a Router instance
const router: Router = Router();

/**
 * Global User Middleware
 * Protects all routes mounted below this line with JWT verification.
 */
router.use(jwtCheck);

/**
 * GET categories.
 * Permissions: read:categories
 */
router.get('/',
  checkPermissions('read:categories'),
  getCategories,
);

/**
 * GET category tree.
 * Permissions: read:categories
 */
router.get('/tree',
  getCategoryTree,
);

/**
 * Create a new category.
 * Permissions: create:categories
 */
router.post('/',
  checkPermissions('create:categories'),
  createCategoryRules,
  validate,
  createCategory,
);

/**
 * Delete a specific category.
 * Permissions: delete:categories
 */
router.delete('/:categoryId',
  checkPermissions('delete:categories'),
  attachCategory,
  deleteCategory,
);

/**
 * Update a specific category.
 * Permissions: update:categories
 */
router.put('/:categoryId',
  checkPermissions('update:categories'),
  updateCategoryRules,
  validate,
  attachCategory,
  updateCategory,
);

// Export the router
export default router;
