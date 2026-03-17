import { describe, it, expect, vi } from 'vitest';

/**
 * 1. HOISTED HELPER CONTAINER
 * We use a non-async vi.hoisted to store our mock factory.
 * This avoids the TS1378 Top-Level Await error in PyCharm.
 */
const helper = vi.hoisted(() => ({
  createMockFn: null as any
}));

/**
 * 2. MOCK GUARDS (Async Factory)
 * We use an async factory to safely import the shared test utility.
 */
vi.mock('../utils/routeGuards.js', async () => {
  const utils = await vi.importActual<typeof import('../test/routeTest.utils.js')>('../test/routeTest.utils.js');
  helper.createMockFn = utils.createMockFn;

  return {
    createRouteGuards: vi.fn(() => ({
      // We append "-self" to the mock name if isSelf is true to verify it in tests
      guard: vi.fn((perm, rules = [], isSelf = false) => [
        helper.createMockFn(`guard-${perm}${isSelf ? '-self' : ''}`),
        ...rules
      ]),
      guardedResource: vi.fn((perm, rules = [], isSelf = false) => [
        helper.createMockFn(`resource-${perm}${isSelf ? '-self' : ''}`),
        ...rules
      ]),
    })),
  };
});

/**
 * 3. MOCK CONTROLLERS
 */
vi.mock('../controllers/users.js', () => ({
  createUser: helper.createMockFn('createUser'),
  deleteUser: helper.createMockFn('deleteUser'),
  getUsers: helper.createMockFn('getUsers'),
  getUser: helper.createMockFn('getUser'),
  updateUser: helper.createMockFn('updateUser'),
  updateUserPassword: helper.createMockFn('updateUserPassword'),
  syncUser: helper.createMockFn('syncUser'),
  createAddress: helper.createMockFn('createAddress'),
  deleteAddress: helper.createMockFn('deleteAddress'),
  updateAddress: helper.createMockFn('updateAddress'),
}));

/**
 * 4. MOCK RULES
 */
vi.mock('../middleware/index.js', () => ({
  createUserRules: [helper.createMockFn('rule-create-user')],
  updateUserRules: [helper.createMockFn('rule-update-user')],
  updatePasswordRules: [helper.createMockFn('rule-password')],
}));

/**
 * 5. NORMAL IMPORTS
 */
import router from './users.js'; // this triggers the route registration
import { getRouteStack } from '../test/routeTest.utils.js';

describe('User Routes', () => {
  // We inspect the stack of the Express router using the shared helper
  // to flatten the Express stack to see what was registered
  const routes = getRouteStack(router);

  it('should register GET / with read permissions', () => {
    const route = routes.find(r => r.path === '/' && r.method === 'get');
    expect(route?.middleware).toContain('guard-read:users');
    expect(route?.middleware).toContain('getUsers');
  });

  it('should register GET /:userId with isSelf enabled', () => {
    const route = routes.find(r => r.path === '/:userId' && r.method === 'get');
    // Verifies that the 'true' flag was passed to the guard
    expect(route?.middleware).toContain('resource-read:users-self');
    expect(route?.middleware).toContain('getUser');
  });

  it('should register PUT /:userId/password with password rules and isSelf', () => {
    const route = routes.find(r => r.path === '/:userId/password' && r.method === 'put');
    expect(route?.middleware).toContain('resource-self-self');
    expect(route?.middleware).toContain('rule-password');
    expect(route?.middleware).toContain('updateUserPassword');
  });

  it('should register POST /sync without guards', () => {
    const route = routes.find(r => r.path === '/sync' && r.method === 'post');
    expect(route?.middleware).toContain('syncUser');
    expect(route?.middleware.length).toBe(1); // No guards or rules
  });

  describe('Address Sub-Routes', () => {
    it('should register POST /:userId/address/ with create:addresses and isSelf', () => {
      const route = routes.find(r => r.path === '/:userId/address/' && r.method === 'post');
      expect(route?.middleware).toContain('resource-create:addresses-self');
      expect(route?.middleware).toContain('createAddress');
    });

    it('should register PUT /:userId/address/:addressId with update permissions', () => {
      const route = routes.find(r => r.path === '/:userId/address/:addressId' && r.method === 'put');
      expect(route?.middleware).toContain('resource-update:addresses-self');
      expect(route?.middleware).toContain('updateAddress');
    });
  });
});