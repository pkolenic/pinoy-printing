import { Router } from 'express';
import { createRouteGuards } from "../utils/routeGuards.js";
import {
  createCategory,
  deleteCategory,
  getCategory,
  getCategories,
  getCategoryTree,
  updateCategory,
} from '../controllers/categories.js'
import {
  createCategoryRules,
  updateCategoryRules,
} from "../middleware/index.js";

import { Category } from '../models/index.js';

//Define allowed permission strings
type CategoryPermission =
  | 'read:categories'
  | 'create:categories'
  | 'update:categories'
  | 'delete:categories'
  | '';

// ROUTE GUARDS
const { guard, guardedResource } = createRouteGuards<CategoryPermission>(Category, 'categoryId', 'category');

// Define a Router instance
const router = Router();

// ROUTES
router.get('/', guard('read:categories'), getCategories);
router.post('/', guard('create:categories', createCategoryRules), createCategory);
router.get('/tree', guard(''), getCategoryTree);

router.route('/:categoryId')
  .get(guardedResource('read:categories'), getCategory)
  .delete(guardedResource('delete:categories'), deleteCategory)
  .put(guardedResource('update:categories', updateCategoryRules), updateCategory);

// Export the router
export default router;
