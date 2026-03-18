import { describe, it, expect, vi, beforeEach } from 'vitest';
import { errorHandler, notFoundHandler } from './errors';
import { logger } from '../utils/logging';
import { AppError } from '../utils/errors';
import { StatusCodes } from 'http-status-codes';

vi.mock('../utils/logging/index.js', () => ({
  logger: { error: vi.fn() }
}));

describe('Error Handlers', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      method: 'GET',
      protocol: 'http',
      originalUrl: '/test',
      get: vi.fn().mockReturnValue('localhost:3000'),
      tenantConfig: { tenantId: 'tenant-abc' }
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
    next = vi.fn();
  });

  describe('errorHandler', () => {
    it('should handle AppError with specific status codes', () => {
      const error = new AppError('Unauthorized Access', StatusCodes.UNAUTHORIZED);

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unauthorized Access'
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle generic third-party errors with a .status property', () => {
      const error = { message: 'JWT Expired', status: StatusCodes.UNAUTHORIZED };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('[401]') })
      );
    });

    it('should default to 500 Internal Server Error for unknown errors', () => {
      const error = new Error('Boom!');

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Boom!' })
      );
    });

    it('should extract statusCode from third-party error objects', () => {
      const thirdPartyError = { message: 'DB Error', statusCode: StatusCodes.FORBIDDEN };

      errorHandler(thirdPartyError, req, res, next);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.FORBIDDEN);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'DB Error' })
      );
    });

    it('should use default message if err.message is undefined', () => {
      const emptyError = {}; // No message property

      errorHandler(emptyError, req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Internal Server Error' })
      );
    });

    it('should default tenantId to "system" when tenantConfig is missing', () => {
      const error = new Error('Generic Error');
      delete req.tenantConfig; // Ensure it is undefined

      errorHandler(error, req, res, next);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'system' })
      );
    });

    it('should fallback to 500 if an object is passed without status/statusCode', () => {
      const weirdError = { someOtherProp: true };

      errorHandler(weirdError, req, res, next);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
    });

    it('should fallback to 500 inside the else-if block if status/statusCode are null or undefined', () => {
      const nullStatusError = { status: undefined };

      errorHandler(nullStatusError, req, res, next);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining(`[${StatusCodes.INTERNAL_SERVER_ERROR}]`)
        })
      );
    });
  });

  describe('notFoundHandler', () => {
    it('should create an AppError and pass it to next()', () => {
      req.originalUrl = '/missing-page';

      notFoundHandler(req, res, next);

      // Verify next was called with an AppError
      const passedError = next.mock.calls[0][0];
      expect(passedError).toBeInstanceOf(AppError);
      expect(passedError.statusCode).toBe(StatusCodes.NOT_FOUND);
      expect(passedError.message).toContain('/missing-page');
    });
  });
});
