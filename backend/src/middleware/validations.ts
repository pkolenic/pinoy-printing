import {
  NextFunction,
  Response,
  Request,
  RequestHandler
} from 'express';
import {
  body,
  validationResult,
  Result,
  ValidationChain,
  ValidationError,
} from 'express-validator';

// Core email validation logic
const emailBase: ValidationChain = body('email')
  .isEmail().withMessage('Please provide a valid email address')
  .normalizeEmail(); // Sanitizes email (e.g., lowercase, removes dots in Gmail)

// Core phone validation logic
const phoneBase: ValidationChain = body('phone')
  .isMobilePhone('any', { strictMode: true })
  .withMessage('Invalid phone format, use the E.164 format ^+[0-9]{1,15}$');

// Core password validation logic
const passwordBase: ValidationChain = body('password')
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

// Rule Sets - Arrays of ValidationChain
export const createEmailRules: ValidationChain[] = [emailBase];
export const updateEmailRules: ValidationChain[] = [emailBase.optional()];
export const phoneRules: ValidationChain[] = [phoneBase.optional()];
export const passwordRules: ValidationChain[] = [passwordBase];

/**
 * Middleware to check for errors after rules run
 * @param req
 * @param res
 * @param next
 */
export const validate: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const errors: Result<ValidationError> = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  // Return early with 400 Bad Request if validation fails
  res.status(400).json({ errors: errors.array() });
};
