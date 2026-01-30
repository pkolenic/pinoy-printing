import { body, ValidationChain } from 'express-validator';
import { withValidation } from "./common.js";

// Shared Base Rules
const emailBase = body('email')
  .isEmail().withMessage('Please provide a valid email address')
  .normalizeEmail(); // Sanitizes email (e.g., lowercase, removes dots in Gmail)

// Core phone validation logic
const phoneBase = body('phone')
  .isMobilePhone('any', { strictMode: true })
  .withMessage('Invalid phone format, use the E.164 format ^+[0-9]{1,15}$');

// Core password validation logic
const passwordBase = body('password')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters long')
  .isStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  .withMessage(
    'Password must contain at least 8 characters, including uppercase, lowercase, numbers, and special characters'
  );

/**
 * Rules for POST /api/users/
 */
export const createUserRules = withValidation([
  emailBase,
  phoneBase.optional(),
  passwordBase,
]);

/**
 * Rules for PUT /api/users/:userId
 */
export const updateUserRules = withValidation([
  emailBase.optional(),
  phoneBase.optional(),
]);

/**
 * Rules for PUT /api/users/:userId/password
 */
export const updatePasswordRules = withValidation([
  passwordBase,
]);
