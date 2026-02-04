import { Router } from "express";
import multer from 'multer';
import { createRouteGuards } from "../utils/routeGuards.js";
import {
  createProduct,
  getProduct,
  getProducts,
  updateProduct,
  deleteProduct,
  importProducts,
  getImportTemplate,
} from "../controllers/products.js";
import {
  createProductRules,
  updateProductRules,
  importProductRules,
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

// Define a multer instance and specify the upload destination
const upload = multer({ dest: 'uploads/' });

// ROUTES
router.get('/import/template', guard('create:products'), getImportTemplate);
router.get('/', getProducts);
router.post('/', guard('create:products'), createProductRules, createProduct)
router.post(
  '/import',
  guard('create:products'),
  upload.single('file'),
  importProductRules,
  importProducts,
);

router.route('/:productId')
  .get(guardedResource(''), getProduct)
  .delete(guardedResource('delete:products'), deleteProduct)
  .put(guardedResource('update:products', updateProductRules), updateProduct);

// Export the router
export default router;
