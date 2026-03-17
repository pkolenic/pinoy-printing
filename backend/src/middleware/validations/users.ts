import { body } from 'express-validator';
import { withValidation } from "./common.js";

// Shared Base Rules
const getEmailBase = () => body('email')
  .exists().withMessage('Email is required')
  .bail()
  .isEmail().withMessage('Please provide a valid email address')
  .normalizeEmail(); // Sanitizes email (e.g., lowercase, removes dots in Gmail)

// Core phone validation logic
const getPhoneBase = () => body('phone')
  .optional({ values: 'null' })
  .isMobilePhone('any', { strictMode: true })
  .withMessage('Invalid phone format, use the E.164 format ^+[0-9]{1,15}$');

// Core password validation logic
const getPasswordBase = () => body('password')
  .exists().withMessage('Password is required')
  .bail()
  .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
  .bail()
  .isStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  .withMessage('Password must include uppercase, lowercase, numbers, and symbols');

/**
 * Rules for POST /api/users/
 */
export const createUserRules = withValidation([
  getEmailBase(),
  getPhoneBase(),
  getPasswordBase(),
]);

/**
 * Rules for PUT /api/users/:userId
 */
export const updateUserRules = withValidation([
  getEmailBase().optional(),
  getPhoneBase(),
]);

/**
 * Rules for PUT /api/users/:userId/password
 */
export const updatePasswordRules = withValidation([
  getPasswordBase(),
]);

