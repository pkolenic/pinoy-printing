import { body, validationResult } from 'express-validator';

// Core email validation logic
const emailBase = body('email')
  .isEmail().withMessage('Please provide a valid email address')
  .normalizeEmail(); // Sanitizes email (e.g., lowercase, removes dots in Gmail)

const phoneBase = body('phone')
  .isMobilePhone('any', { strictMode: true })
  .withMessage('Invalid phone format, use the E.164 format ^+[0-9]{1,15}$');

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

/** @type {import('express').RequestHandler[]} */
export const createEmailRules = [emailBase];

/** @type {import('express').RequestHandler[]} */
export const updateEmailRules = [emailBase.optional()];

/** @type {import('express').RequestHandler[]} */
export const phoneRules = [phoneBase.optional()];

/** @type {import('express').RequestHandler[]} */
export const passwordRules = [passwordBase];

// Middleware to check for errors after rules run
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  return res.status(400).json({ errors: errors.array() });
};
