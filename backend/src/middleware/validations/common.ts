import { RequestHandler } from 'express';
import { StatusCodes } from "http-status-codes";
import {
  Result,
  ValidationChain,
  ValidationError,
  validationResult,
} from 'express-validator';

/**
 * Middleware to check for errors after rules run
 */
export const validate: RequestHandler = (req, res, next) => {
  const errors: Result<ValidationError> = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  res.status(StatusCodes.BAD_REQUEST).json({ errors: errors.array() });
};

/**
 * Helper to bundle rules with the `validate` middleware.
 * @param rules
 */
export const withValidation = (rules: ValidationChain[]): (ValidationChain | RequestHandler)[] => [
  ...rules,
  validate
];
