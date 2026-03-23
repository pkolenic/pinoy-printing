import { describe, it, expect, vi } from 'vitest';
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import * as expressValidator from 'express-validator';
import { withValidation, validate } from './common.js';

// Mock express-validator's validationResult
vi.mock('express-validator', async () => {
  const actual = await vi.importActual('express-validator');
  return {
    ...actual,
    validationResult: vi.fn(),
  };
});

describe('Common Validation Middleware', () => {
  describe('validate middleware', () => {
    it('should call next() if there are no validation errors', () => {
      // Mock validationResult to return an empty result
      (expressValidator.validationResult as any).mockReturnValue({
        isEmpty: () => true,
      });

      const req = {} as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      validate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 400 if there are validation errors', () => {
      const mockErrors = [{ msg: 'Error 1' }, { msg: 'Error 2' }];
      (expressValidator.validationResult as any).mockReturnValue({
        isEmpty: () => false,
        array: () => mockErrors,
      });

      const req = {} as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      validate(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith({ errors: mockErrors });
    });
  });

  describe('withValidation middleware', () => {
    it('should return an array containing the rules followed by the validate middleware', () => {
      const rules = [expressValidator.body('test').notEmpty()];
      const result = withValidation(rules);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(rules[0]);
      expect(result[1]).toBe(validate);
    });
  });
});