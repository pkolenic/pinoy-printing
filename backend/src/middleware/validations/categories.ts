import { body } from 'express-validator';
import { withValidation } from './common.js';

// Base rule for category names
const getCategoryNameBase = () => body('name')
  .trim()
  .exists().withMessage('Category Name is required')
  .bail()
  .notEmpty().withMessage('Category Name is required')
  .bail()
  .isLength({ min: 2 }).withMessage('Category Name must be at least 2 characters long');

// Rule for parent ID validation
const getCategoryParentBase = () => body('parent')
  .optional({ values: 'null' }) // Allows field to be null or missing
  .isMongoId().withMessage('Parent must be a valid Category ID');

/**
 * Rules for POST /api/categories/
 */
export const createCategoryRules = withValidation([
  getCategoryNameBase(),
  getCategoryParentBase(),
]);

/**
 * Rules for PUT /api/categories/:categoryId
 */
export const updateCategoryRules = withValidation([
  getCategoryNameBase().optional(),  // Allows partial updates
  getCategoryParentBase(),
]);
