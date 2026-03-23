import { StatusCodes } from 'http-status-codes';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAttachMiddleware } from './models.js';
import { AppError } from '../utils/errors';

describe('createAttachMiddleware', () => {
  let mockReq: any;
  let mockRes: any;
  const next = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRes = {};

    // Setup a basic mock request structure
    const mockExec = vi.fn();
    const mockFindById = vi.fn(() => ({ exec: mockExec }));

    mockReq = {
      params: { categoryId: '123' },
      tenantModels: {
        Category: {
          findById: mockFindById,
          exec: mockExec,
        },
      },
    };
  });

  it('should skip fetching if the resource is already attached', async () => {
    mockReq.category = { _id: 'pre-existing' };

    const middleware = createAttachMiddleware('Category', 'categoryId', 'category');
    await middleware(mockReq, mockRes, next);

    expect(mockReq.tenantModels.Category.findById).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  it('should return 400 if the specified param is missing from req.params', async () => {
    mockReq.params = {}; // Empty params

    const middleware = createAttachMiddleware('Category', 'categoryId', 'category');
    await middleware(mockReq, mockRes, next);

    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
    expect(error.message).toContain('Missing parameter');
  });

  it('should fetch an item and attach it to the request object', async () => {
    const mockItem = { _id: '123', name: 'Electronics' };
    mockReq.tenantModels.Category.exec.mockResolvedValue(mockItem);

    // Create middleware to find 'Category' using 'categoryId' param and attach as 'category'
    const middleware = createAttachMiddleware('Category', 'categoryId', 'category');
    await middleware(mockReq, mockRes, next);

    expect(mockReq.category).toEqual(mockItem);
    expect(next).toHaveBeenCalledWith();
  });

  it('should call next with NOT_FOUND error if the item is not found', async () => {
    mockReq.tenantModels.Category.exec.mockResolvedValue(null);

    const middleware = createAttachMiddleware('Category', 'categoryId', 'category');
    await middleware(mockReq, mockRes, next);

    const error = next.mock.calls[0][0] as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(StatusCodes.NOT_FOUND);
    expect(error.message).toBe('Category not found');
  });

  it('should return 400 for a Mongoose CastError (invalid ID format)', async () => {
    const castError = new Error('Cast Error');
    castError.name = 'CastError';
    mockReq.tenantModels.Category.exec.mockRejectedValue(castError);

    const middleware = createAttachMiddleware('Category', 'categoryId', 'category');
    await middleware(mockReq, mockRes, next);

    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
    expect(error.message).toContain('Invalid categoryId');
  });

  it('should pass through existing AppErrors', async () => {
    const customError = new AppError('Custom Error', StatusCodes.BAD_REQUEST);
    mockReq.tenantModels.Category.exec.mockRejectedValue(customError);

    const middleware = createAttachMiddleware('Category', 'categoryId', 'category');
    await middleware(mockReq, mockRes, next);

    const error = next.mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
    expect(error.message).toBe('Custom Error');
  });

  it('should return 500 even if a non-Error object is thrown', async () => {
    mockReq.tenantModels.Category.exec.mockRejectedValue("Literal String Error");

    const middleware = createAttachMiddleware('Category', 'categoryId', 'category');
    await middleware(mockReq, mockRes, next);

    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(error.message).toBe('Internal Server Error');
  });

  it('should handle generic database errors', async () => {
    mockReq.tenantModels.Category.exec.mockRejectedValue(new Error('Mongoose Error'));

    const middleware = createAttachMiddleware('Category', 'categoryId', 'category');
    await middleware(mockReq, mockRes, next);

    const error = next.mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(error.message).toBe('Mongoose Error');
  });

});
