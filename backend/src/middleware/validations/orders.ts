import { body } from 'express-validator';
import { withValidation } from './common.js';

const orderBase = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Order must contain at least one item'),

  body('items.*.product')
    .isMongoId()
    .withMessage('Each item must have a valid Product ID'),

  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Each item quantify must be atleast 1'),

  body('items.*.customization')
    .optional()
    .isObject()
    .withMessage('Each item customization must be an object'),
]

export const createOrderRules = withValidation([
  ...orderBase,
]);
