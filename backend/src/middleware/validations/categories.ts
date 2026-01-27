import { body, ValidationChain } from 'express-validator';

// Base rule for category names
const categoryNameBase = body('name')
  .trim()
  .notEmpty().withMessage('Category name is required')
  .isLength({ min: 2 }).withMessage('Name must be at least 2 characters long');

// Rule for parent ID validation
const categoryParentBase = body('parent')
  .optional({ nullable: true }) // Allows field to be null or missing
  .isMongoId().withMessage('Parent must be a valid Mongo ID');

/**
 * Rules for POST /api/categories/
 */
export const createCategoryRules: ValidationChain[] = [
  categoryNameBase,
  categoryParentBase
];

/**
 * Rules for PUT /api/categories/:categoryId
 */
export const updateCategoryRules: ValidationChain[] = [
  categoryNameBase.optional(), // Allows partial updates
  categoryParentBase
];
