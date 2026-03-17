import { body } from 'express-validator';
import fs from 'fs';
import readline from 'readline/promises';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../utils/errors/index.js';
import { withValidation } from './common.js';
import { cleanText } from "../../utils/strings.js";
import { CSV_PRODUCT_HEADERS } from '../../models/index.js'

/**
 * Base rule for Product validation
 */
const getProductBase = () => [
  body('name')
    .trim()
    .exists().withMessage('Product name is required')
    .bail()
    .notEmpty().withMessage('Product name is required')
    .bail()
    .customSanitizer(cleanText()),

  body('sku')
    .trim()
    .notEmpty().withMessage('Product SKU is required')
    .bail()
    .customSanitizer(cleanText({ lowercase: true })),

  body('description')
    .trim()
    .exists().withMessage('Description is required')
    .bail()
    .notEmpty().withMessage('Description is required')
    .bail()
    .isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters')
    .customSanitizer(cleanText()),

  body('details')
    .optional({ values: 'null' })
    .trim()
    .isLength({ max: 10000 }).withMessage('Details cannot exceed 10000 characters')
    .customSanitizer(cleanText({ mode: 'richText' })),

  body('price')
    .exists().withMessage('Price is required')
    .bail()
    .isFloat({ min: 0 }).withMessage('Price must be a positive number'),

  body('category')
    .exists().withMessage('Category is required')
    .bail()
    .isMongoId().withMessage('Category must be a valid category ID'),

  body('quantity')
    .optional({ values: 'null' })
    .isInt({ min: 0 }).withMessage('Quantity must be zero or greater'),

  body('customizationSchema')
    .optional({ values: 'null' })
    .isObject().withMessage('Customization schema must be a valid JSON object'),

  body('image')
    .optional({ values: 'null' })
    .trim()
    .isString()
    .bail()
    .isLength({ max: 255 })
    .bail()
    .matches(/\.(jpg|jpeg|png|webp|gif)$/i)
    .withMessage('Image must be a valid path ending in jpg, png, webp, or gif'),
]

/**
 * Rules for POST /api/products/
 */
export const createProductRules = withValidation([
  ...getProductBase(),
]);

/**
 * Rules for PUT /api/products/:productId
 * All fields are optional
 */
export const updateProductRules = withValidation([
  ...getProductBase().map(rule => rule.optional()),
]);

/**
 * Rules for POST /api/products/import
 */
export const importProductRules = withValidation([
  body('file').custom(async (_value, { req }) => {
    // 1. Check that a file was uploaded
    if (!req.file) {
      throw new AppError('CSV file is required', StatusCodes.BAD_REQUEST);
    }

    const { path: filePath, originalname } = req.file;
    const cleanup = () => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    };

    // 2. Check extension BEFORE the try block
    if (!originalname.toLowerCase().endsWith('.csv')) {
      cleanup();
      throw new AppError('Uploaded file must be a CSV', StatusCodes.BAD_REQUEST);
    }

    let firstLineResult;
    let fileStream;

    // 3. Wrap the risky I/O operations in try/catch
    try {
      fileStream = fs.createReadStream(filePath);
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
      const lineIterator = rl[Symbol.asyncIterator]();

      firstLineResult = await lineIterator.next();

      rl.close();
      fileStream.destroy();
    } catch (error) {
      cleanup();
      // Only generic I/O errors end up here
      throw new AppError('Failed to parse CSV headers', StatusCodes.BAD_REQUEST);
    }

    // 4. Perform data validation
    if (firstLineResult.done || !firstLineResult.value) {
      cleanup();
      throw new AppError('CSV file is empty', StatusCodes.BAD_REQUEST);
    }

    const headers = firstLineResult.value
      .split(',')
      .map(h => h.trim().replace(/^["'](.+)["']$/, '$1'));

    const missingHeaders = CSV_PRODUCT_HEADERS.filter(h => !headers.includes(h));

    if (missingHeaders.length > 0) {
      cleanup();
      throw new AppError(
        `Missing required CSV columns: ${missingHeaders.join(', ')}`,
        StatusCodes.BAD_REQUEST
      );
    }
    return true;
  })
]);
