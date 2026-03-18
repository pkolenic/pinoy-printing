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

  // TODO - how to validate address is setup for the country(ies) that the site is configured for?

  body('address')
    .optional()
    .isObject().withMessage('Shipping address must be an object'),

  body('address.street')
    .if(body('address').exists())
    .notEmpty().withMessage('Street is required'),

  body('address.city')
    .if(body('address').exists())
    .notEmpty().withMessage('City is required'),

  body('address.region')
    .if(body('address').exists())
    .notEmpty().withMessage('Region is required'), // TODO - need message based on site configuration, need to validate region codes based on site configuration

  body('address.postalCode')
    .if(body('address').exists())
    .notEmpty().withMessage('Postal code is required'),  // TODO - need message based on site configuration, need to validate postal codes based on site configuration

  body('address._isPrimaryInput').not().exists().withMessage('Orders do not support multiple addresses'),
]

export const createOrderRules = withValidation([
  ...getOrderBase(),
]);

export const updateOrderRules = withValidation([
  ...getOrderBase().map(rule => rule.optional()),

  // Prevent clients from manually setting the price during an update
  body('items.*.price')
    .not().exists()
    .withMessage('Item prices are calculated by the system and cannot be modified directly'),

  // Prevent changing the User the order belongs to
  body('userId').not().exists().withMessage('The order owner cannot be changed'),

  // Explicitly block status/paid/shipped from this general update route
  body(['status', 'paid', 'shipped']).not().exists()
    .withMessage('Use dedicated routes to update status, payment, or shipping info'),
]);
