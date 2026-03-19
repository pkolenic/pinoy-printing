import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getManagementClient,
  clearAuth0Cache,
  getRoleId,
  getValidatedRole,
  USER_ROLE_IDS
} from './auth0';
import { ManagementClient } from 'auth0';
import { AppError } from '../utils/errors';
import { StatusCodes } from 'http-status-codes';

// Mock the Auth0 module to prevent real network/SDK initialization
vi.mock('auth0', () => ({
  ManagementClient: vi.fn(function () {
    return {};
  })
}));

describe('Auth0 Service', () => {
  const mockConfig = {
    issuerDomain: 'test.auth0.com',
    managementClientId: 'id',
    managementClientSecret: 'secret',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await clearAuth0Cache();

    // Ensure a clean state for Role ID tests
    USER_ROLE_IDS.admin = 'rol_admin';
    USER_ROLE_IDS.customer = 'rol_customer';
    USER_ROLE_IDS.owner = 'rol_owner';
    USER_ROLE_IDS.staff = 'rol_staff';
  });

  describe('getManagementClient', () => {
    it('should create and cache a new client per tenant', () => {
      const client1 = getManagementClient('tenant-a', mockConfig);
      const client2 = getManagementClient('tenant-a', mockConfig);

      expect(ManagementClient).toHaveBeenCalledTimes(1);
      expect(client1).toBe(client2); // Verifies caching works
    });

    it('should throw AppError if credentials are missing', () => {
      const invalidConfig = { ...mockConfig, issuerDomain: '' };

      try {
        getManagementClient('tenant-err', invalidConfig as any)
        expect.fail('Should have thrown an AppError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(error.message).toContain('Auth0 credentials missing for tenant:');
      }
    });

    it('should throw AppError if the SDK constructor fails', () => {
      (ManagementClient as any).mockImplementationOnce(function () {
        throw new Error('SDK error');
      });

      try {
        getManagementClient('tenant-fail', mockConfig)
        expect.fail('Should have thrown an AppError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(error.message).toContain('Failed to initialize Auth0 client for tenant');
      }
    });
  });

  describe('getRoleId', () => {
    it('should return the correct ID from environment mapping', () => {
      expect(getRoleId('admin')).toBe('rol_admin');
    });

    it('should throw 500 AppError if the role ID is not configured', () => {
      USER_ROLE_IDS.admin = undefined;

      try {
        getRoleId('admin');
        expect.fail('Should have thrown an AppError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(error.message).toContain('Auth0 Role ID not found');
      }
    });
  });

  describe('getValidatedRole', () => {
    it('should normalize and return a valid role', () => {
      expect(getValidatedRole('ADMIN')).toBe('admin');
    });

    it('should default to "customer" for unknown or missing input', () => {
      expect(getValidatedRole('hacker')).toBe('customer');
      expect(getValidatedRole(undefined)).toBe('customer');
    });
  });

  describe('clearAuth0Cache', () => {
    it('should clear the cache so new clients are initialized', async () => {
      // Call 1
      getManagementClient('tenant-1', mockConfig);
      // Call 2 (should be cached, so total calls = 1)
      getManagementClient('tenant-1', mockConfig);

      await clearAuth0Cache();

      // Call 3 (cache is gone, so total calls = 2)
      getManagementClient('tenant-1', mockConfig);

      expect(ManagementClient).toHaveBeenCalledTimes(2);
    });
  });
});
