import { Router } from "express";
import { createRouteGuards } from "../utils/routeGuards.js";
import {
  createProduct,
  getProduct,
  getProducts,
  updateProduct,
  deleteProduct,
} from "../controllers/products.js";
import {
  createProductRules,
  updateProductRules,
} from "../middleware/index.js";

import { Product } from "../models/index.js";

type ProductPermission =
  | 'read:products'
  | 'create:products'
  | 'update:products'
  | 'delete:products'
  | '';

// ROUTE GUARDS
const { guard, guardedResource } = createRouteGuards<ProductPermission>(Product, 'productId', 'product');

// Define a Router instance
export const router = Router();

// ROUTES
router.get('/', getProducts);
router.post('/', guard('create:products'), createProductRules, createProduct)

router.route('/:productId')
  .get(guardedResource(''), getProduct)
  .delete(guardedResource('delete:products'), deleteProduct)
  .put(guardedResource('update:products', updateProductRules), updateProduct);

// Export the router
export default router;
