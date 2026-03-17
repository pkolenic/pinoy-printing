import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkPermissions } from './permissions.js';
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../utils/errors';


describe('checkPermissions Middleware', () => {
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
      auth: {
        payload: {
          permissions: [],
          sub: 'user_123'
        },
      },
      params: {},
      tenantModels: {
        User: {
          findById: mockFindById,
          exec: mockExec,
        }
      },
    };
  });

  it('should skip to next if no permission is required', async () => {
    const middleware = checkPermissions('');
    await middleware(mockReq as Request, mockRes as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should call next if the user has the explicit permission', async () => {
    mockReq.auth.payload.permissions = ['read:users'];
    const middleware = checkPermissions('read:users');
    await middleware(mockReq as Request, mockRes as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('should call next and ATTACH user if isSelf is true and subs match', async () => {
    const targetUserId = 'mongo_id_abc';
    const mockUser = { _id: targetUserId, sub: 'auth0|123' };

    mockReq.params = { userId: targetUserId };
    mockReq.auth.payload.sub = 'auth0|123';
    mockReq.tenantModels.User.exec.mockResolvedValue(mockUser);

    const middleware = checkPermissions('admin:only', true);
    await middleware(mockReq, mockRes, next);

    expect(next).toHaveBeenCalledWith();
    // Verify User is attached to the request
    expect(mockReq.user).toEqual(mockUser);
  });

  it('should return 400 if isSelf is true but userId param is missing', async () => {
    mockReq.params = {}; // Missing userId
    const middleware = checkPermissions('self', true);
    await middleware(mockReq, mockRes, next);

    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
    expect(error.message).toBe('User ID missing');
  });

  it('should return 400 if database lookup throws a CastError', async () => {
    mockReq.params = { userId: 'invalid-id' };
    const castError = new Error('Cast Error');
    castError.name = 'CastError';
    mockReq.tenantModels.User.exec.mockRejectedValue(castError);

    const middleware = checkPermissions('some:perm', true);
    await middleware(mockReq, mockRes, next);

    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
    expect(error.message).toBe('Invalid User ID format');
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
    mockReq.params = { userId: '123' };
    mockReq.tenantModels.User.exec.mockResolvedValue(null);

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

  it('should return Internal Server Error even if a non-Error object is thrown', async () => {
    mockReq.params = { userId: '123' };
    // Throwing a string instead of a real Error object
    mockReq.tenantModels.User.exec.mockRejectedValue("Unexpected String Error");

    const middleware = checkPermissions('some:perm', true);
    await middleware(mockReq, mockRes, next);

    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(error.message).toBe('Internal Server Error');
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

  it('should call next(Forbidden) if isSelf is true but user is not found in DB', async () => {
    mockReq.params = { userId: 'non-existent-id' };
    mockReq.tenantModels.User.exec.mockResolvedValue(null); // Database returns null

    const middleware = checkPermissions('some:perm', true);
    await middleware(mockReq, mockRes, next);

    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(StatusCodes.FORBIDDEN);
  });
});
