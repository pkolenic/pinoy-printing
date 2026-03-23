import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import { matchedData } from 'express-validator';

import * as Auth0Service from '../services/auth0.js';
import * as Models from '../models';
import * as SystemUtils from '../utils/system.js';
import * as DBService from '../services/db.js';
import * as TenantContext from '../types/tenantContext.js';
import * as QueryHelper from '../utils/controllers/queryHelper.js';
import { logger } from '../utils/logging';
import { AppError } from '../utils/errors';

import {
  createUser,
  deleteUser,
  getUser,
  getUsers,
  syncUser,
  updateUser,
  updateUserPassword,
  createAddress,
  deleteAddress,
  updateAddress,
} from './users';

// Mock Auth0 Service
vi.mock('../services/auth0.js', () => ({
  getManagementClient: vi.fn(),
  getRoleId: vi.fn(),
  getValidatedRole: vi.fn(),
  USER_ROLE_IDS: {
    admin: 'auth0_admin_role_id',
    customer: 'auth0_customer_role_id',
  }
}));

// Mock Database/Tenant Service
vi.mock('../services/db.js', () => ({
  getTenantDb: vi.fn(),
  SiteConfiguration: {
    findOne: vi.fn().mockReturnThis(),
    exec: vi.fn(),
    lean: vi.fn()
  }
}));

// Mock Tenant Context
vi.mock('../types/tenantContext.js', () => ({
  getTenantModels: vi.fn()
}));

// Mock express-validator
vi.mock('express-validator', () => ({
  matchedData: vi.fn(),
}));

// Mock System Utils
vi.mock('../utils/system.js', () => ({
  getTenantId: vi.fn(),
}));

// Mock Logger
vi.mock('../utils/logging/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    colors: {
      SYSTEM_WARNING: 'bgYellow',
    },
  },
}));

vi.mock('../utils/pagination.js', () => ({
  paginateResponse: vi.fn((_req, data, count, page, limit) => ({ data, count, page, limit })),
}));

vi.mock('../utils/controllers/queryHelper.js', () => ({
  parsePagination: vi.fn(),
  buildSort: vi.fn(),
}));

describe('User Controller', () => {
  describe('User Methods', () => {
    describe('createUser', () => {
      let req: any;
      let res: any;
      let next: any;
      let mockUserModel: any;
      let mockAuth0Client: any;

      beforeEach(() => {
        vi.clearAllMocks();

        // 1. Mock Auth0 Management Client Methods
        mockAuth0Client = {
          users: {
            create: vi.fn().mockResolvedValue({
              user_id: 'auth0|123',
              name: 'John Doe',
              email: 'john@example.com',
              username: 'johndoe'
            }),
            update: vi.fn().mockResolvedValue({}),
            roles: {
              assign: vi.fn().mockResolvedValue({}),
            }
          }
        };

        // 2. Mock Auth0 Service helpers
        vi.mocked(Auth0Service.getManagementClient).mockReturnValue(mockAuth0Client);
        vi.mocked(Auth0Service.getRoleId).mockReturnValue('role_abc_123');
        vi.mocked(Auth0Service.getValidatedRole).mockImplementation(
          (r): Auth0Service.UserRole => (r as Auth0Service.UserRole) || 'customer'
        );

        // 3. Mock Mongoose Model (Constructor pattern)
        mockUserModel = vi.fn(function (this: Partial<Models.IUserDocument>, data) {
          Object.assign(this, data);
          this.id = 'mongo_id_123';
          this.save = vi.fn().mockResolvedValue(this);
          return this;
        });

        // 4. Mock Tenant Service
        vi.mocked(SystemUtils.getTenantId).mockReturnValue('my.tenant.com');

        req = {
          tenantModels: { User: mockUserModel },
          tenantConfig: {
            tenantId: 'my.tenant.com',
            backend: {
              auth0: {
                authorizationDB: 'Username-Password-Authentication'
                // Ensure any other properties used by getManagementClient are here
              }
            }
          },
          auth: { payload: { permissions: ['update:user-roles'] } },
          body: {
            username: 'johndoe',
            email: 'john@example.com',
            name: 'John Doe',
            role: 'admin'
          },
          // Adding headers just in case getTenantId isn't mocked correctly
          headers: { host: 'my.tenant.com' }
        };

        res = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn().mockReturnThis(),
        };

        next = vi.fn();
      });

      it('should create Auth0 user, assign role, save to DB, and update metadata', async () => {
        await createUser(req, res, next);

        // Verify Auth0 creation
        expect(mockAuth0Client.users.create).toHaveBeenCalledWith(expect.objectContaining({
          email: 'john@example.com'
        }));

        // Verify Role assignment
        expect(mockAuth0Client.users.roles.assign).toHaveBeenCalledWith(
          'auth0|123',
          { roles: ['role_abc_123'] }
        );

        // Verify Mongoose save (constructor was called with correct data)
        expect(mockUserModel).toHaveBeenCalledWith(expect.objectContaining({
          sub: 'auth0|123',
          role: 'admin'
        }));

        // Verify Metadata sync (check the key replacement my.tenant.com -> my_tenant_com)
        expect(mockAuth0Client.users.update).toHaveBeenCalledWith(
          'auth0|123',
          { app_metadata: { my_tenant_com: { role: 'admin', id: 'mongo_id_123' } } }
        );

        expect(res.status).toHaveBeenCalledWith(StatusCodes.CREATED);
      });

      it('should include phone details in Auth0 payload if phone is provided', async () => {
        req.body.phone = '+1234567890'; // Hits lines 50-53

        await createUser(req, res, next);

        expect(mockAuth0Client.users.create).toHaveBeenCalledWith(expect.objectContaining({
          phone_number: '+1234567890',
          phone_verified: true
        }));
        // Verify it was also passed to the Mongoose constructor
        expect(mockUserModel).toHaveBeenCalledWith(expect.objectContaining({
          phone: '+1234567890'
        }));
      });

      it('should default canSetRole to false if permissions are missing from auth payload', async () => {
        // Force the left side of ?? to be null/undefined
        req.auth.payload.permissions = undefined;

        await createUser(req, res, next);

        // Verification: Since canSetRole defaults to false, the role becomes 'customer'
        // regardless of what was in req.body.role
        expect(mockUserModel).toHaveBeenCalledWith(expect.objectContaining({
          role: 'customer'
        }));

        // Also verify getValidatedRole was NOT called with the restricted role
        expect(Auth0Service.getValidatedRole).not.toHaveBeenCalledWith('admin');
      });

      it('should default to customer role if requester lacks update:user-roles permission', async () => {
        req.auth.payload.permissions = []; // Strip permissions

        await createUser(req, res, next);

        expect(mockUserModel).toHaveBeenCalledWith(expect.objectContaining({
          role: 'customer'
        }));
      });

      it('should return 500 error if Auth0 fails to return a user_id', async () => {
        mockAuth0Client.users.create.mockResolvedValue({ user_id: undefined });

        await createUser(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(AppError));
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(500);
        expect(error.message).toBe('Failed to create Auth0 user');
      });

      it('should catch and pass external service errors to next', async () => {
        const error = new Error('Auth0 API Limit');
        mockAuth0Client.users.create.mockRejectedValue(error);

        await createUser(req, res, next);

        expect(next).toHaveBeenCalledWith(error);
      });
    });

    describe('syncUser', () => {
      let req: any;
      let res: any;
      let next: any;
      let mockUserModel: any;
      let mockAuth0Client: any;

      beforeEach(() => {
        vi.clearAllMocks();
        process.env.PINOY_SHOP_API_KEY = 'super-secret-key';

        // Mock the User Model (Chainable and Constructor)
        const mockQuery = {
          lean: vi.fn(),
          exec: vi.fn().mockReturnThis()
        };
        const mockMongoId = new Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d1');

        mockUserModel = vi.fn(function (this: Partial<Models.IUserDocument>, data: any) {
          Object.assign(this, data);

          // Manually add these to satisfy the controller's logic
          this._id = mockMongoId;
          this.id = mockMongoId.toString();

          // Mock methods using the same Partial context
          this.save = vi.fn().mockResolvedValue(this);
          this.toObject = vi.fn().mockReturnValue({
            ...data,
            _id: mockMongoId,
            id: mockMongoId.toString()
          });

          return this;
        });
        mockUserModel.findOne = vi.fn().mockReturnValue(mockQuery);

        // Mock Tenant/DB Services
        const mockSiteConfig = {
          tenantId: 'my_tenant',
          backend: {
            auth0: {
              domain: 'tenant-auth.auth0.com',
              clientId: 'client_123',
              clientSecret: 'secret_abc',
              authorizationDB: 'Username-Password-Authentication'
            }
          }
        };
        vi.mocked(DBService.SiteConfiguration.findOne).mockResolvedValue(mockSiteConfig);
        vi.mocked(DBService.getTenantDb).mockResolvedValue({} as any);
        vi.mocked(TenantContext.getTenantModels).mockReturnValue({ User: mockUserModel } as any);

        // Mock Auth0 Client
        mockAuth0Client = {
          users: {
            get: vi.fn().mockResolvedValue({ user_id: 'auth0|123', name: 'New User' }),
            update: vi.fn().mockResolvedValue({}),
            roles: { assign: vi.fn().mockResolvedValue({}) }
          }
        };
        vi.mocked(Auth0Service.getManagementClient).mockReturnValue(mockAuth0Client);

        req = {
          body: { userId: 'auth0|123', tenant_id: 'my_tenant', secret: 'super-secret-key' }
        };

        res = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn().mockReturnThis()
        };

        next = vi.fn();
      });

      it('should sync an existing user and update Auth0 metadata', async () => {
        const existingUserId = new Types.ObjectId();
        const mockUserInstance = {
          _id: existingUserId,
          role: 'customer'
        };

        // Mock the .lean() chain
        mockUserModel.findOne.mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockUserInstance)
        });

        await syncUser(req, res, next);

        // Verify the string ID was used in the metadata update
        expect(mockAuth0Client.users.update).toHaveBeenCalledWith(
          'auth0|123',
          expect.objectContaining({
            app_metadata: {
              my_tenant: { role: 'customer', id: existingUserId.toString() }
            }
          })
        );
      });

      it('should create a new user if one does not exist', async () => {
        // Simulate user not in DB
        vi.mocked(mockUserModel.findOne().lean).mockResolvedValue(null);

        await syncUser(req, res, next);

        expect(mockAuth0Client.users.roles.assign).toHaveBeenCalled();
        expect(mockUserModel).toHaveBeenCalledWith(expect.objectContaining({ name: 'New User' }));
        expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      });

      it('should return 401 if the secret is invalid', async () => {
        req.body.secret = 'wrong-secret';

        await syncUser(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(AppError));
        expect(next.mock.calls[0][0].statusCode).toBe(StatusCodes.UNAUTHORIZED);
        expect(logger.warn).toHaveBeenCalled();
      });

      it('should return 400 if required parameters are missing', async () => {
        req.body = { userId: 'auth0|123' }; // Missing tenant_id and secret

        await syncUser(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(AppError));
        expect(next.mock.calls[0][0].message).toBe('Missing required sync parameters');
      });

      it('should return 400 if tenant configuration is not found', async () => {
        // Simulate the database returning null for the config
        vi.mocked(DBService.SiteConfiguration.findOne).mockResolvedValue(null);

        await syncUser(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(AppError));
        const error = next.mock.calls[0][0];
        expect(error.message).toBe('Invalid Tenant');
        expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('should return 400 AppError if Auth0 user_id is missing from fetch result', async () => {
        // Simulate Auth0 returning a payload without the ID
        mockAuth0Client.users.get.mockResolvedValue({ email: 'no-id@test.com' });

        await syncUser(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(AppError));
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
        expect(error.message).toBe('Failed to find Auth0 user');
      });

      it('should catch and pass unexpected errors to next()', async () => {
        const error = new Error('Auth0 Management API Down');
        // Force a failure on the first await inside the try block
        mockAuth0Client.users.get.mockRejectedValue(error);

        await syncUser(req, res, next);

        expect(next).toHaveBeenCalledWith(error);
      });
    });

    describe('deleteUser', () => {
      let req: any;
      let res: any;
      let next: any;
      let mockAuth0Client: any;
      let mockUserInstance: any;

      beforeEach(() => {
        vi.clearAllMocks();

        // 1. Mock the specific user instance found on req
        mockUserInstance = {
          sub: 'auth0|123',
          deleteOne: vi.fn().mockResolvedValue({}),
        };

        // 2. Mock Auth0 Management Client
        mockAuth0Client = {
          users: {
            delete: vi.fn().mockResolvedValue({}),
          }
        };
        // noinspection DuplicatedCode
        vi.mocked(Auth0Service.getManagementClient).mockReturnValue(mockAuth0Client);
        vi.mocked(SystemUtils.getTenantId).mockReturnValue('my.tenant.com');

        req = {
          user: mockUserInstance,
          tenantConfig: {
            backend: { auth0: { domain: 'auth.com' } }
          },
          // Headers might be needed for getTenantId
          headers: { host: 'my.tenant.com' }
        };

        res = {
          status: vi.fn().mockReturnThis(),
          end: vi.fn().mockReturnThis(),
        };

        next = vi.fn();
      });

      it('should delete from Auth0, then MongoDB, and return 204', async () => {
        await deleteUser(req, res, next);

        // Verify Auth0 deletion was called with the correct sub
        expect(mockAuth0Client.users.delete).toHaveBeenCalledWith('auth0|123');

        // Verify MongoDB deletion was called on the instance
        expect(mockUserInstance.deleteOne).toHaveBeenCalled();

        // Verify 204 No Content response
        expect(res.status).toHaveBeenCalledWith(StatusCodes.NO_CONTENT);
        expect(res.end).toHaveBeenCalled();
      });

      it('should return 404 AppError if user is missing from req', async () => {
        req.user = undefined;

        await deleteUser(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(AppError));
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(StatusCodes.NOT_FOUND);
        expect(error.message).toBe('User not found');
      });

      it('should catch and pass errors to next()', async () => {
        const error = new Error('Auth0 Deletion Failed');
        mockAuth0Client.users.delete.mockRejectedValue(error);

        await deleteUser(req, res, next);

        expect(next).toHaveBeenCalledWith(error);
      });
    });

    describe('getUser', () => {
      let req: any;
      let res: any;
      let next: any;
      let mockAuth0Client: any;
      let mockUserInstance: any;

      beforeEach(() => {
        vi.clearAllMocks();

        // 1. Mock the user instance with Mongoose methods
        mockUserInstance = {
          sub: 'auth0|123',
          populate: vi.fn().mockResolvedValue(this),
          toObject: vi.fn().mockReturnValue({
            name: 'John Doe',
            email: 'john@example.com',
            sub: 'auth0|123',
            picture: 'old-pic.jpg',
            orders: []
          }),
        };

        // 2. Mock Auth0 Management Client
        mockAuth0Client = {
          users: {
            get: vi.fn().mockResolvedValue({
              user_id: 'auth0|123',
              picture: 'latest-auth0-pic.png'
            }),
          }
        };

        // noinspection DuplicatedCode
        vi.mocked(Auth0Service.getManagementClient).mockReturnValue(mockAuth0Client);
        vi.mocked(SystemUtils.getTenantId).mockReturnValue('my.tenant.com');

        req = {
          user: mockUserInstance,
          tenantConfig: { backend: { auth0: { domain: 'auth.com' } } },
          headers: { host: 'my.tenant.com' }
        };

        res = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn().mockReturnThis(),
        };

        next = vi.fn();
      });

      it('should populate orders, sync with Auth0, and return 200 with merged data', async () => {
        await getUser(req, res, next);

        // Verify Mongoose population
        expect(mockUserInstance.populate).toHaveBeenCalledWith('orders');

        // Verify Auth0 sync
        expect(mockAuth0Client.users.get).toHaveBeenCalledWith('auth0|123');

        // Verify the response contains the LATEST picture from Auth0
        expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          picture: 'latest-auth0-pic.png',
          name: 'John Doe'
        }));
      });

      it('should return 404 AppError if user is missing from req', async () => {
        req.user = undefined;

        await getUser(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(AppError));
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(StatusCodes.NOT_FOUND);
        expect(error.message).toBe('User not found');
      });

      it('should catch and pass service errors to next()', async () => {
        const error = new Error('Auth0 Get Failure');
        mockAuth0Client.users.get.mockRejectedValue(error);

        await getUser(req, res, next);

        expect(next).toHaveBeenCalledWith(error);
      });
    });

    describe('getUsers', () => {
      let req: any;
      let res: any;
      let next: any;
      let mockUserModel: any;
      let mockQuery: any;

      beforeEach(() => {
        vi.clearAllMocks();

        // 1. Setup Chainable Mock
        mockQuery = {
          sort: vi.fn().mockReturnThis(),
          skip: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          lean: vi.fn(),
        };

        mockUserModel = {
          find: vi.fn().mockReturnValue(mockQuery),
          countDocuments: vi.fn(),
        };

        req = {
          tenantModels: { User: mockUserModel },
          query: {},
        };

        res = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn().mockReturnThis(),
        };

        next = vi.fn();

        // 2. Mock Query Helpers
        vi.mocked(QueryHelper.parsePagination).mockReturnValue({ limit: 100, page: 1, skip: 0 });
        vi.mocked(QueryHelper.buildSort).mockReturnValue({ name: 1 });
      });

      it('should return paginated users with 200 OK', async () => {
        const mockUsers = [{ name: 'Alice', email: 'alice@test.com' }];
        mockUserModel.countDocuments.mockResolvedValue(1);
        mockQuery.lean.mockResolvedValue(mockUsers);

        await getUsers(req, res, next);

        expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          data: mockUsers,
          count: 1
        }));
      });

      it('should apply filters for role, phone, and search', async () => {
        req.query = {
          role: 'admin',
          phone: '555',
          search: 'bob'
        };

        mockQuery.lean.mockResolvedValue([]);
        mockUserModel.countDocuments.mockResolvedValue(0);

        await getUsers(req, res, next);

        // Verify the query object built by the controller
        expect(mockUserModel.find).toHaveBeenCalledWith(expect.objectContaining({
          role: 'admin',
          phone: { $regex: '555', $options: 'i' },
          $or: [
            { name: { $regex: 'bob', $options: 'i' } },
            { username: { $regex: 'bob', $options: 'i' } },
            { email: { $regex: 'bob', $options: 'i' } },
          ]
        }));
      });

      it('should ignore invalid roles', async () => {
        req.query = { role: 'not-a-real-role' };
        mockQuery.lean.mockResolvedValue([]);
        mockUserModel.countDocuments.mockResolvedValue(0);

        await getUsers(req, res, next);

        // the role should NOT be in the query object
        expect(mockUserModel.find).toHaveBeenCalledWith({});
      });

      it('should catch database errors and pass to next()', async () => {
        const error = new Error('Connection Timeout');
        mockUserModel.countDocuments.mockRejectedValue(error);

        await getUsers(req, res, next);

        expect(next).toHaveBeenCalledWith(error);
      });
    });

    describe('updateUser', () => {
      let req: any;
      let res: any;
      let next: any;
      let mockAuth0Client: any;
      let mockUserInstance: any;

      beforeEach(() => {
        vi.clearAllMocks();

        // 1. Mock User Instance on Req
        mockUserInstance = {
          sub: 'auth0|123',
          set: vi.fn().mockReturnThis(),
          save: vi.fn().mockResolvedValue(this),
        };

        // 2. Mock Auth0 Management Client
        mockAuth0Client = {
          users: {
            update: vi.fn().mockResolvedValue({}),
            get: vi.fn().mockResolvedValue({ picture: 'new-pic.jpg' }),
            roles: {
              list: vi.fn().mockResolvedValue({ data: [{ id: 'old-role-id' }] }),
              delete: vi.fn().mockResolvedValue({}),
              assign: vi.fn().mockResolvedValue({}),
            },
          },
        };

        vi.mocked(Auth0Service.getManagementClient).mockReturnValue(mockAuth0Client);
        vi.mocked(Auth0Service.getValidatedRole).mockImplementation((r) => r as any);
        vi.mocked(Auth0Service.getRoleId).mockReturnValue('new-role-id');

        req = {
          user: mockUserInstance,
          tenantConfig: { backend: { auth0: { domain: 'auth.com' } } },
          auth: { payload: { permissions: ['update:user-roles'] } },
        };

        res = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn().mockReturnThis(),
        };

        next = vi.fn();
      });

      it('should update email, phone, and role if permissions exist', async () => {
        const updates = {
          email: 'new@test.com',
          phone: '12345',
          role: 'admin',
          name: 'New Name'
        };
        vi.mocked(matchedData).mockReturnValue(updates);

        await updateUser(req, res, next);

        // Verify contact updates
        expect(mockAuth0Client.users.update).toHaveBeenCalledWith('auth0|123', {
          email: 'new@test.com',
          email_verified: true
        });
        expect(mockAuth0Client.users.update).toHaveBeenCalledWith('auth0|123', {
          phone_number: '12345',
          phone_verified: true
        });

        // Verify role rotation logic
        expect(mockAuth0Client.users.roles.list).toHaveBeenCalledWith('auth0|123');
        expect(mockAuth0Client.users.roles.delete).toHaveBeenCalledWith('auth0|123', { roles: ['old-role-id'] });
        expect(mockAuth0Client.users.roles.assign).toHaveBeenCalledWith('auth0|123', { roles: ['new-role-id'] });

        // Verify final Mongo sync
        expect(mockUserInstance.set).toHaveBeenCalled();
        expect(mockUserInstance.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      });

      it('should skip the general Auth0 update if only specific fields are changed', async () => {
        // Provide ONLY email (which is destructured out of otherUpdates)
        vi.mocked(matchedData).mockReturnValue({ email: 'only-email@test.com' });

        await updateUser(req, res, next);

        // Verify the email update happened (Line 284)
        expect(mockAuth0Client.users.update).toHaveBeenCalledWith('auth0|123', expect.objectContaining({ email: 'only-email@test.com' }));

        // Verify the GENERAL update (Line 321) was NOT called because generalAuthData was empty
        const updateCalls = mockAuth0Client.users.update.mock.calls;
        // The first call was for email, there should be no second call for metadata if nothing else changed
        const metadataUpdateCall = updateCalls.find((call: any) => !call[1].email);
        expect(metadataUpdateCall).toBeUndefined();
      });

      it('should skip role update if user lacks update:user-roles permission', async () => {
        req.auth.payload.permissions = [];
        vi.mocked(matchedData).mockReturnValue({ role: 'admin', name: 'New Name' });

        await updateUser(req, res, next);

        // Should NOT call Auth0 role methods
        expect(mockAuth0Client.users.roles.assign).not.toHaveBeenCalled();

        // Role should be removed from DB updates
        const dbUpdates = vi.mocked(mockUserInstance.set).mock.calls[0][0];
        expect(dbUpdates.role).toBeUndefined();
      });

      it('should default canSetRole to false if auth permissions are missing', async () => {
        // Force the left side of ?? to be undefined
        req.auth = { payload: {} };

        // Provide a role to see if it gets rejected
        vi.mocked(matchedData).mockReturnValue({ role: 'admin' });

        await updateUser(req, res, next);

        // Verification: canSetRole was false, so Auth0 role assign was never called
        expect(mockAuth0Client.users.roles.assign).not.toHaveBeenCalled();
        // Role should have been deleted from dbUpdates
        expect(mockUserInstance.set).toHaveBeenCalledWith(expect.not.objectContaining({ role: 'admin' }));
      });

      it('should return 404 if user is missing from req', async () => {
        req.user = undefined;
        await updateUser(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.any(AppError));
      });

      it('should handle cases where user has no existing roles in Auth0', async () => {
        vi.mocked(matchedData).mockReturnValue({ role: 'staff' });
        mockAuth0Client.users.roles.list.mockResolvedValue({ data: [] });

        await updateUser(req, res, next);

        // delete should NOT be called if currentRoleIds is empty
        expect(mockAuth0Client.users.roles.delete).not.toHaveBeenCalled();
        expect(mockAuth0Client.users.roles.assign).toHaveBeenCalled();
      });

      it('should catch and pass errors to next()', async () => {
        const error = new Error('Auth0 Timeout');
        mockAuth0Client.users.update.mockRejectedValue(error);
        vi.mocked(matchedData).mockReturnValue({ email: 'fail@test.com' });

        await updateUser(req, res, next);

        expect(next).toHaveBeenCalledWith(error);
      });
    });

    describe('updateUserPassword', () => {
      let req: any;
      let res: any;
      let next: any;
      let mockAuth0Client: any;
      let mockUserInstance: any;

      beforeEach(() => {
        vi.clearAllMocks();

        // 1. Mock User Instance on Req
        mockUserInstance = {
          sub: 'auth0|123',
        };

        // 2. Mock Auth0 Management Client
        mockAuth0Client = {
          users: {
            update: vi.fn().mockResolvedValue({}),
          },
        };

        vi.mocked(Auth0Service.getManagementClient).mockReturnValue(mockAuth0Client);
        vi.mocked(SystemUtils.getTenantId).mockReturnValue('my.tenant.com');

        req = {
          user: mockUserInstance,
          tenantConfig: { backend: { auth0: { domain: 'auth.com' } } },
          body: { password: 'NewSecurePassword123!' },
          headers: { host: 'my.tenant.com' }
        };

        res = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn().mockReturnThis(),
        };

        next = vi.fn();
      });

      it('should successfully update the password in Auth0 and return 200', async () => {
        await updateUserPassword(req, res, next);

        // Verify Auth0 update call specifically for password
        expect(mockAuth0Client.users.update).toHaveBeenCalledWith('auth0|123', {
          password: 'NewSecurePassword123!'
        });

        expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
        expect(res.json).toHaveBeenCalledWith({ message: "Password updated successfully" });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 400 AppError if password is missing from body', async () => {
        req.body.password = undefined;

        await updateUserPassword(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(AppError));
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(400);
        expect(error.message).toBe('Password is required');
      });

      it('should return 404 AppError if user is missing from req', async () => {
        req.user = undefined;

        await updateUserPassword(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(AppError));
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(StatusCodes.NOT_FOUND);
      });

      it('should catch and pass Auth0 service errors to next()', async () => {
        const error = new Error('Auth0 Password Policy Violation');
        mockAuth0Client.users.update.mockRejectedValue(error);

        await updateUserPassword(req, res, next);

        expect(next).toHaveBeenCalledWith(error);
      });
    });
  });

  describe('Address Methods', () => {
    describe('createAddress', () => {
      let req: any;
      let res: any;
      let next: any;
      let mockUserInstance: any;

      beforeEach(() => {
        vi.clearAllMocks();

        // 1. Create a mock for the new address subdocument
        const mockNewAddress = {
          _id: 'address_123',
          street: '123 Main St',
          city: 'Boise',
        };

        // 2. Mock the User instance with an addresses array that has a .create method
        mockUserInstance = {
          addresses: {
            create: vi.fn().mockReturnValue(mockNewAddress),
            push: vi.fn(),
          },
          save: vi.fn().mockResolvedValue(this),
        };

        req = {
          user: mockUserInstance,
          body: { street: '123 Main St', city: 'Boise' },
        };

        res = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn().mockReturnThis(),
        };

        next = vi.fn();
      });

      it('should create a subdocument, push it to addresses, and return 201', async () => {
        await createAddress(req, res, next);

        // Verify subdocument creation
        expect(mockUserInstance.addresses.create).toHaveBeenCalledWith(req.body);

        // Verify it was pushed to the parent array
        expect(mockUserInstance.addresses.push).toHaveBeenCalledWith(
          expect.objectContaining({ _id: 'address_123' })
        );

        // Verify parent save
        expect(mockUserInstance.save).toHaveBeenCalled();

        expect(res.status).toHaveBeenCalledWith(StatusCodes.CREATED);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ _id: 'address_123' }));
      });

      it('should return 404 AppError if user is missing from req', async () => {
        req.user = undefined;

        await createAddress(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(AppError));
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(StatusCodes.NOT_FOUND);
      });

      it('should catch validation errors from save() and pass to next', async () => {
        const error = new Error('Validation Failed');
        mockUserInstance.save.mockRejectedValue(error);

        await createAddress(req, res, next);

        expect(next).toHaveBeenCalledWith(error);
      });
    });

    describe('deleteAddress', () => {
      let req: any;
      let res: any;
      let next: any;
      let mockUserInstance: any;

      beforeEach(() => {
        vi.clearAllMocks();

        // 1. Mock the User instance with a subdocument array
        mockUserInstance = {
          addresses: {
            id: vi.fn(),   // Used to check if an address exists
            pull: vi.fn(), // Used to remove the address
          },
          save: vi.fn().mockResolvedValue(this),
        };

        req = {
          user: mockUserInstance,
          params: { addressId: 'address_123' },
        };

        res = {
          status: vi.fn().mockReturnThis(),
          end: vi.fn().mockReturnThis(),
        };

        next = vi.fn();
      });

      it('should find the address, pull it from the array, and return 204', async () => {
        // Simulate address found
        mockUserInstance.addresses.id.mockReturnValue({ _id: 'address_123' });

        await deleteAddress(req, res, next);

        // Verify lookup
        expect(mockUserInstance.addresses.id).toHaveBeenCalledWith('address_123');

        // Verify atomic pull
        expect(mockUserInstance.addresses.pull).toHaveBeenCalledWith({ _id: 'address_123' });

        // Verify parent save (triggers the pre-validate hooks)
        expect(mockUserInstance.save).toHaveBeenCalled();

        expect(res.status).toHaveBeenCalledWith(StatusCodes.NO_CONTENT);
        expect(res.end).toHaveBeenCalled();
      });

      it('should return 404 if the address does not exist in the array', async () => {
        // Simulate address not found
        mockUserInstance.addresses.id.mockReturnValue(null);

        await deleteAddress(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(AppError));
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(StatusCodes.NOT_FOUND);
        expect(error.message).toBe('Address not found');
      });

      it('should return 404 if user is missing from req', async () => {
        req.user = undefined;

        await deleteAddress(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(AppError));
        expect(next.mock.calls[0][0].statusCode).toBe(StatusCodes.NOT_FOUND);
      });

      it('should catch database errors during save and pass to next', async () => {
        mockUserInstance.addresses.id.mockReturnValue({ _id: 'address_123' });
        const error = new Error('Database Error');
        mockUserInstance.save.mockRejectedValue(error);

        await deleteAddress(req, res, next);

        expect(next).toHaveBeenCalledWith(error);
      });
    });

    describe('updateAddress', () => {
      let req: any;
      let res: any;
      let next: any;
      let mockUserInstance: any;
      let mockAddressSubdocument: any;

      beforeEach(() => {
        vi.clearAllMocks();

        // 1. Mock the specific address subdocument
        mockAddressSubdocument = {
          _id: 'address_123',
          set: vi.fn().mockReturnThis(),
        };

        // 2. Mock the User instance
        mockUserInstance = {
          addresses: {
            id: vi.fn(),
          },
          save: vi.fn().mockResolvedValue(this),
        };

        req = {
          user: mockUserInstance,
          params: { addressId: 'address_123' },
        };

        res = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn().mockReturnThis(),
        };

        next = vi.fn();
      });

      it('should find the address, apply updates via .set(), and return 200', async () => {
        const updates = { street: '456 New St', city: 'Boise' };
        vi.mocked(matchedData).mockReturnValue(updates);
        mockUserInstance.addresses.id.mockReturnValue(mockAddressSubdocument);

        await updateAddress(req, res, next);

        // Verify subdocument lookup
        expect(mockUserInstance.addresses.id).toHaveBeenCalledWith('address_123');

        // Verify .set() was called with validated updates
        expect(mockAddressSubdocument.set).toHaveBeenCalledWith(updates);

        // Verify parent save
        expect(mockUserInstance.save).toHaveBeenCalled();

        expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
        expect(res.json).toHaveBeenCalledWith(mockAddressSubdocument);
      });

      it('should return 404 if the address ID does not exist in the array', async () => {
        mockUserInstance.addresses.id.mockReturnValue(null);
        vi.mocked(matchedData).mockReturnValue({});

        await updateAddress(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(AppError));
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(StatusCodes.NOT_FOUND);
        expect(error.message).toBe('Address not found');
      });

      it('should return 404 if user is missing from req', async () => {
        req.user = undefined;

        await updateAddress(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(AppError));
        expect(next.mock.calls[0][0].statusCode).toBe(StatusCodes.NOT_FOUND);
      });

      it('should catch and pass errors to next()', async () => {
        mockUserInstance.addresses.id.mockReturnValue(mockAddressSubdocument);
        const error = new Error('Database Error');
        mockUserInstance.save.mockRejectedValue(error);

        await updateAddress(req, res, next);

        expect(next).toHaveBeenCalledWith(error);
      });
    });
  });
});
