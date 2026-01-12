import { body, validationResult } from 'express-validator';

// Core email validation logic
const emailBase = body('email')
  .isEmail().withMessage('Please provide a valid email address')
  .normalizeEmail(); // Sanitizes email (e.g., lowercase, removes dots in Gmail)

const phoneBase = body('phone')
  .isMobilePhone('any', { strictMode: true })
  .withMessage('Invalid phone format, use the E.164 format ^+[0-9]{1,15}$');

/** @type {import('express').RequestHandler[]} */
export const createEmailRules = [emailBase];

/** @type {import('express').RequestHandler[]} */
export const updateEmailRules = [emailBase.optional()];

/** @type {import('express').RequestHandler[]} */
export const phoneRules = [phoneBase.optional()];

// Middleware to check for errors after rules run
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  return res.status(400).json({ errors: errors.array() });
};
