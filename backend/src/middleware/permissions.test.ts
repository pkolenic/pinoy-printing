import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkPermissions } from './permissions.js';
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../utils/errors';

// Extend the Request type specifically for these tests
interface AuthenticatedRequest extends Request {
  auth?: {
    payload: {
      permissions: string[];
      sub: string;
    };
  };
  tenantModels: {
    User: {
      findById: any;
      exec: any;
    };
  };
}

describe('checkPermissions Middleware', () => {
  let mockReq: Partial<AuthenticatedRequest>;
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
      auth: {
        payload: {
          permissions: [],
          sub: 'user_123'
        },
      },
      params: {},
      tenantModels: {
        User: mockModel,
      },
    };
  });

  it('should skip to next if no permission is required', async () => {
    const middleware = checkPermissions('');
    await middleware(mockReq as Request, mockRes as Response, next);

    expect(next).toHaveBeenCalledWith();
  });


  it('should call next if the user has the explicit permission', async () => {
    mockReq.auth!.payload.permissions = ['read:users'];
    const middleware = checkPermissions('read:users');
    await middleware(mockReq as Request, mockRes as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should call next if isSelf is true and the user sub matches', async () => {
    const targetUserId = 'mongo_id_abc';
    mockReq.params = { userId: targetUserId };
    mockReq.auth!.payload.sub = 'auth0|123';

    // Mock the DB finding a user with a matching 'sub'
    (mockReq.tenantModels!.User.exec as any).mockResolvedValue({
      _id: targetUserId,
      sub: 'auth0|123',
    });

    const middleware = checkPermissions('admin:only', true);
    await middleware(mockReq as Request, mockRes as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should throw Forbidden if user lacks permission and isSelf fails', async () => {
    mockReq.auth!.payload.permissions = ['other:perm'];

    const middleware = checkPermissions('required:perm');
    await middleware(mockReq as Request, mockRes as Response, next);

    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(StatusCodes.FORBIDDEN);
    expect(error.message).toContain('Forbidden');
  });

  it('should throw Forbidden if user lacks explicit permission and isSelf is false', async () => {
    // User has some permission, but not the one required
    mockReq.auth!.payload.permissions = ['read:profile'];

    // Set isSelf to false explicitly (or rely on default)
    const middleware = checkPermissions('write:settings', false);
    await middleware(mockReq as Request, mockRes as Response, next);

    // Capture the error passed to next()
    const error = next.mock.calls[0][0] as AppError;

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(StatusCodes.FORBIDDEN);
    expect(error.message).toBe('Forbidden: Not Authorized');
  });

  it('should throw Internal Server Error if the database lookup fails', async () => {
    mockReq.params = { userId: 'bad_id' };
    (mockReq.tenantModels!.User.exec as any).mockRejectedValue(new Error('DB Fail'));

    const middleware = checkPermissions('some:perm', true);
    await middleware(mockReq as Request, mockRes as Response, next);

    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(error.message).toBe('DB Fail');
  });

  it('should return Forbidden if req.auth is missing (e.g., jwtCheck skipped)', async () => {
    // Simulate a request where the authentication middleware was never run
    delete mockReq.auth;

    const middleware = checkPermissions('some:permission');
    await middleware(mockReq as Request, mockRes as Response, next);

    const error = next.mock.calls[0][0] as AppError;

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(StatusCodes.FORBIDDEN);
    expect(error.message).toContain('Forbidden');
  });
});
