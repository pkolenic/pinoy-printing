import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSiteConfiguration } from './site';
import { AppError } from '../utils/errors';
import { StatusCodes } from 'http-status-codes';
import { Request, Response } from 'express';

describe('getSiteConfiguration', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let next: any;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it('should return 200 and frontend config if tenantConfig exists', async () => {
    const config = { frontend: { theme: 'dark' } };
    mockReq.tenantConfig = config as any;

    await getSiteConfiguration(mockReq as Request, mockRes as Response, next);

    expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.OK);
    expect(mockRes.json).toHaveBeenCalledWith(config.frontend);
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next with AppError if tenantConfig is missing', async () => {
    mockReq.tenantConfig = undefined;

    await getSiteConfiguration(mockReq as Request, mockRes as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(StatusCodes.NOT_FOUND);
    expect(error.message).toBe('Site Configuration not found');
  });

  it('should catch unexpected errors and pass them to next', async () => {
    // Simulate a crash by making the check throw
    Object.defineProperty(mockReq, 'tenantConfig', {
      get: () => {
        throw new Error('Database down');
      }
    });

    await getSiteConfiguration(mockReq as Request, mockRes as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe('Database down');
  });
});
