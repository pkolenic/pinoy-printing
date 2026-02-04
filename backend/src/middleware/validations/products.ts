import { body } from 'express-validator';
import sanitizeHtml from 'sanitize-html';
import fs from 'fs';
import csv from 'csv-parser';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../utils/errors/index.js';
import { withValidation } from './common.js';
import { CSV_PRODUCT_HEADERS } from '../../models/index.js'

/**
 * Base rule for Product validation
 */
const productBase = [
  body('name').trim().notEmpty().withMessage('Product name is required').escape(),
  body('sku').trim().notEmpty().withMessage('Product SKU is required').escape(),
  body('description')
    .trim()
    .notEmpty().withMessage('Description is required')
    .isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters')
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
    .isLength({ max: 10000 }).withMessage('Details cannot exceed 10000 characters'),
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

/**
 * Rules for POST /api/products/import
 */
export const importProductRules = withValidation([
  body('file').custom(async (_value, { req }) => {
    if (!req.file) {
      throw new AppError('CSV file is required', StatusCodes.BAD_REQUEST);
    }

    const filePath = req.file.path;

    if (!req.file.originalname.toLowerCase().endsWith('.csv')) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw new AppError('Uploaded file must be a CSV', StatusCodes.BAD_REQUEST);
    }

    // Logic to extract headers
    const headers = await new Promise<string[]>((resolve, reject) => {
      const stream = fs.createReadStream(filePath)
        .pipe(csv())
        .on('headers', (h) => {
          stream.destroy();
          resolve(h);
        })
        .on('error', () => {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          reject(new AppError('Failed to parse CSV headers', StatusCodes.BAD_REQUEST));
        });
    });

    const missingHeaders = CSV_PRODUCT_HEADERS.filter(h => !headers.includes(h));

    if (missingHeaders.length > 0) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw new AppError(
        `Missing required CSV columns: ${missingHeaders.join(', ')}`,
        StatusCodes.BAD_REQUEST
      );
    }

    return true;
  })
]);
