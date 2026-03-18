import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jwtCheck } from './auth';
import { auth, UnauthorizedError } from 'express-oauth2-jwt-bearer';
import { Request, Response } from 'express';

// 1. Mock the Auth0 library
vi.mock('express-oauth2-jwt-bearer', () => ({
  auth: vi.fn(),
  UnauthorizedError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'UnauthorizedError';
    }
  }
}));

describe('jwtCheck Middleware', () => {
  let req: any;
  let res: any;
  let next: any;
  let mockInternalJwtCheck: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default tenant configuration
    req = {
      tenantConfig: {
        backend: {
          settings: { requireAuthentication: true },
          auth0: {
            audience: 'test-audience',
            issuerDomain: 'test.auth0.com',
            tokenSigningAlgorithm: 'RS256'
          }
        }
      }
    };
    res = {};
    next = vi.fn();

    // 2. Set up the internal function that auth() returns
    mockInternalJwtCheck = vi.fn();
    vi.mocked(auth).mockReturnValue(mockInternalJwtCheck);
  });

  it('should initialize auth with correct tenant config', () => {
    jwtCheck(req as Request, res as Response, next);

    expect(auth).toHaveBeenCalledWith({
      audience: 'test-audience',
      issuerBaseURL: 'https://test.auth0.com/',
      tokenSigningAlg: 'RS256',
    });
  });

  it('should proceed if authentication is successful', () => {
    jwtCheck(req as Request, res as Response, next);

    // Simulate internalJwtCheck calling its callback with no error
    const authCallback = mockInternalJwtCheck.mock.calls[0][2];
    authCallback();

    expect(next).toHaveBeenCalledWith();
  });

  it('should pass error to next if auth is required and fails', () => {
    req.tenantConfig.backend.settings.requireAuthentication = true;
    const authError = new Error('Invalid Token');

    jwtCheck(req as Request, res as Response, next);

    const authCallback = mockInternalJwtCheck.mock.calls[0][2];
    authCallback(authError);

    expect(next).toHaveBeenCalledWith(authError);
  });

  it('should allow the request if auth is optional and fails with UnauthorizedError', () => {
    req.tenantConfig.backend.settings.requireAuthentication = false;
    const authError = new UnauthorizedError('No token provided');

    jwtCheck(req as Request, res as Response, next);

    const authCallback = mockInternalJwtCheck.mock.calls[0][2];
    authCallback(authError);

    // When optional, UnauthorizedError is ignored, and we proceed
    expect(next).toHaveBeenCalledWith();
  });

  it('should pass through non-unauthorized errors even if auth is optional', () => {
    req.tenantConfig.backend.settings.requireAuthentication = false;
    const genericError = new Error('Network Error');

    jwtCheck(req as Request, res as Response, next);

    const authCallback = mockInternalJwtCheck.mock.calls[0][2];
    authCallback(genericError);

    expect(next).toHaveBeenCalledWith(genericError);
  });
});