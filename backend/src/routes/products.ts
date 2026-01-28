import { Router, RequestHandler } from "express";

import {
  createProduct,
  getProduct,
  getProducts,
  updateProduct,
  deleteProduct,
} from "../controllers/products.js";
import {
  checkPermissions,
  createAttachMiddleware,
  createProductRules,
  updateProductRules,
  validate,
  jwtCheck,
} from "../middleware/index.js";

import { Product } from "../models/index.js";

const attachProduct: RequestHandler = createAttachMiddleware(Product, 'productId', 'product');

// Define a Router instance
export const router: Router = Router();

/**
 * Global User Middleware
 * Protects all routes mounted below this line with JWT verification.
 */
router.use(jwtCheck);

/**
 * GET products.
 * Permissions: read:products
 */
router.get('/',
  checkPermissions('read:products'),
  getProducts,
);

/**
 * GET a specific product.
 * Permissions: read:products
 */
router.get('/:productId',
  checkPermissions('read:products'),
  attachProduct,
  getProduct,
);

/**
 * POST Create a new product.
 * Permissions: create:products
 */
router.post('/',
  checkPermissions('create:products'),
  createProductRules,
  validate,
  createProduct,
)

/**
 * DELETE a specific product.
 * Permissions: delete:products
 */
router.delete('/:productId',
  checkPermissions('delete:products'),
  attachProduct,
  deleteProduct,
)

/**
 * PUT Update a specific product.
 * Permissions: update:products
 */
router.put('/:productId',
  checkPermissions('update:products'),
  updateProductRules,
  validate,
  attachProduct,
  updateProduct,
)

// Export the router
export default router;
