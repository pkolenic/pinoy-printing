import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loggerMiddleware } from './logger';
import { logger } from '../utils/logging';
import { Request, Response } from 'express';
import { StatusCodes } from "http-status-codes";

// 1. Mock the logger singleton
vi.mock('../utils/logging/index.js', () => ({
  logger: {
    info: vi.fn(),
    colors: { GET: 'blue' }
  }
}));

describe('loggerMiddleware', () => {
  let req: any;
  let res: any;
  let next: any;
  let eventCallbacks: Record<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    eventCallbacks = {};

    // 2. Setup mock Request/Response
    req = {
      method: 'GET',
      protocol: 'http',
      originalUrl: '/api/test',
      get: vi.fn().mockReturnValue('localhost:3000'),
      tenantConfig: { tenantId: 'tenant-123' }
    };

    res = {
      statusCode: StatusCodes.OK,
      // Capture the 'finish' callback so we can trigger it manually
      on: vi.fn((event, cb) => {
        eventCallbacks[event] = cb;
        return res;
      })
    };

    next = vi.fn();
  });

  it('should call next() immediately to continue the middleware chain', () => {
    loggerMiddleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should log metadata correctly when the "finish" event fires', () => {
    loggerMiddleware(req as Request, res as Response, next);

    // 3. Manually trigger the 'finish' event recorded in res.on
    if (eventCallbacks['finish']) {
      eventCallbacks['finish']();
    }

    expect(logger.info).toHaveBeenCalledWith({
      message: 'GET[200] http://localhost:3000/api/test',
      tenantId: 'tenant-123',
      color: 'blue'
    });
  });

  it('should fallback to "system" and "white" for missing data', () => {
    req.method = 'UNKNOWN';
    req.tenantConfig = undefined;

    loggerMiddleware(req as Request, res as Response, next);
    eventCallbacks['finish']?.();

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'system',
        color: 'white'
      })
    );
  });
});
