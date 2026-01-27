import {
  RequestHandler
} from 'express';
import {
  validationResult,
  Result,
  ValidationError,
} from 'express-validator';

/**
 * Middleware to check for errors after rules run
 */
export const validate: RequestHandler = (req, res, next) => {
  const errors: Result<ValidationError> = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  // Return early with 400 Bad Request if validation fails
  res.status(400).json({ errors: errors.array() });
};
