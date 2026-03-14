import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAttachMiddleware } from './models.js';
import { AppError } from '../utils/errors';

interface TenantRequest extends Request {
  category?: any;
  tenantModels: {
    Category: {
      findById: any;
      exec: any;
    };
  };
}

describe('createAttachMiddleware', () => {
  let mockReq: Partial<TenantRequest>;
  let mockRes: Partial<Response>;
  const next = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRes = {};
    // Setup a basic mock request structure
    const mockModel = {
      findById: vi.fn().mockReturnThis(),
      exec: vi.fn(),
    };

    mockReq = {
      params: { categoryId: '123' },
      tenantModels: {
        Category: mockModel,
      },
    };
  });

  it('should fetch an item and attach it to the request object', async () => {
    const mockItem = { _id: '123', name: 'Electronics' };
    mockReq.tenantModels.Category.exec.mockResolvedValue(mockItem);

    // Create middleware to find 'Category' using 'categoryId' param and attach as 'category'
    const middleware = createAttachMiddleware('Category', 'categoryId', 'category');
    await middleware(mockReq as unknown as Request, mockRes as Response, next);

    expect(mockReq.category).toEqual(mockItem);
    expect(next).toHaveBeenCalledWith();
  });

  it('should call next with NOT_FOUND error if the item is not found', async () => {
    mockReq.tenantModels.Category.exec.mockResolvedValue(null);

    const middleware = createAttachMiddleware('Category', 'categoryId', 'category');
    await middleware(mockReq as unknown as Request, mockRes as Response, next);

    const error = next.mock.calls[0][0] as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(StatusCodes.NOT_FOUND);
    expect(error.message).toBe('Category not found');
  });

  it('should handle database errors and return INTERNAL_SERVER_ERROR', async () => {
    mockReq.tenantModels.Category.exec.mockRejectedValue(new Error('Mongoose Error'));

    const middleware = createAttachMiddleware('Category', 'categoryId', 'category');
    await middleware(mockReq as unknown as Request, mockRes as Response, next);

    const error = next.mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(error.message).toBe('Mongoose Error');
  });

  it('should pass through existing AppErrors', async () => {
    const customError = new AppError('Custom Error', StatusCodes.BAD_REQUEST);
    mockReq.tenantModels.Category.exec.mockRejectedValue(customError);

    const middleware = createAttachMiddleware('Category', 'categoryId', 'category');
    await middleware(mockReq as unknown as Request, mockRes as Response, next);

    const error = next.mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
    expect(error.message).toBe('Custom Error');
  });
});
