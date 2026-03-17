import { body } from 'express-validator';
import { withValidation } from './common.js';

const getOrderBase = () => [
  body('items')
    .exists().withMessage('Order must contain an array of item objects')
    .bail()
    .isArray().withMessage('Order must contain an array of item objects')
    .bail()
    .isArray({ min: 1 }).withMessage('Order must contain at least one item')
    .bail()
    // Custom check: Ensure every entry in the array is an object
    .custom((items: any[]) => {
      return items.every(item => typeof item === 'object' && item !== null && !Array.isArray(item));
    }).withMessage('Each item in items must be object'),

  body('items.*.product')
    .exists().withMessage('Each item must have a valid Product ID')
    .bail()
    .isMongoId().withMessage('Each item must have a valid Product ID'),

  body('items.*.quantity')
    .exists().withMessage('Each item must have a quantity')
    .bail()
    .isInt().withMessage('Each item quantity must be a whole number')
    .bail()
    .isInt({ min: 1 }).withMessage('Each item must have a quantity greater or equal to 1'),

  body('items.*.customization')
    .optional()
    .isObject().withMessage('Each item\'s customization must be an object'),
]

export const createOrderRules = withValidation([
  ...getOrderBase(),
]);
