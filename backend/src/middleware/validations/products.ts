import { body } from 'express-validator';
import sanitizeHtml from 'sanitize-html';
import { withValidation } from './common.js';

/**
 * Base rule for Product validation
 */
const productBase = [
  body('name').trim().notEmpty().withMessage('Product name is required').escape(),
  body('sku').trim().notEmpty().withMessage('Product SKU is required').escape(),
  body('description')
    .trim()
    .notEmpty().withMessage('Description is required')
    .isLength({ max: 1000}).withMessage('Description cannot exceed 1000 characters')
    .escape(),
  body('details')
    .optional()
    .trim()
    .customSanitizer(value => {
      return sanitizeHtml(value, {
        allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
        allowedAttributes: {} // Block all attributes like 'onerror' or 'style'
      });
    })
    .isLength({ max: 10000}).withMessage('Details cannot exceed 10000 characters'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('category').isMongoId().withMessage('Category must be a valid category ID'),
  body('quantity').optional().isInt({ min: 0 }).withMessage('Quantity must be zero or greater'),
  body('customizationSchema')
    .optional()
    .isObject().withMessage('Customization schema must be a valid JSON object'),
  body('image')
  .optional()
  .trim()
  .isString()
  .isLength({ max: 255 })
  .matches(/\.(jpg|jpeg|png|webp|gif)$/i)
  .withMessage('Image must be a valid path ending in jpg, png, webp, or gif'),
]

/**
 * Rules for POST /api/products/
 */
export const createProductRules = withValidation([
  ...productBase,
]);

/**
 * Rules for PUT /api/products/:productId
 * All fields are optional
 */
export const updateProductRules = withValidation([
  ...productBase.map(rule => rule.optional()),
]);
