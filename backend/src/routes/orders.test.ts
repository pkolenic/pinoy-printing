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
      guard: vi.fn((perm, rules = [], isSelf = false) => [
        helper.createMockFn(`guard-${perm}${isSelf ? '-self' : ''}`),
        ...rules
      ]),
      guardedResource: vi.fn((perm, rules = [], isSelf = false) => [
        helper.createMockFn(`resource-${perm}${isSelf ? '-self' : ''}`),
        ...rules
      ]),
      guardedRelationship: vi.fn((perm, field, rules = [], isSelf = false) => [
        helper.createMockFn(`rel-${perm}-${field}${isSelf ? '-self' : ''}`),
        ...rules
      ]),
    })),
  };
});

/**
 * 3. MOCK CONTROLLERS
 */
vi.mock('../controllers/orders.js', () => ({
  createOrder: helper.createMockFn('createOrder'),
  getOrder: helper.createMockFn('getOrder'),
  getOrders: helper.createMockFn('getOrders'),
  deleteOrder: helper.createMockFn('deleteOrder'),
  updateOrder: helper.createMockFn('updateOrder'),
  getUserOrders: helper.createMockFn('getUserOrders'),
}));

/**
 * 4. MOCK RULES
 */
vi.mock('../middleware/index.js', () => ({
  createOrderRules: [helper.createMockFn('rule-create-order')],
  updateOrderRules: [helper.createMockFn('rule-update-order')],
}));

/**
 * 5. NORMAL IMPORTS
 */
import router from './orders.js';
import { getRouteStack } from '../test/routeTest.utils.js';

describe('Order Routes', () => {
  const routes = getRouteStack(router);

  describe('Admin / Global Routes', () => {
    it('should register GET / for all orders (Admin)', () => {
      const route = routes.find(r => r.path === '/' && r.method === 'get');
      expect(route?.middleware).toContain('guard-read:orders');
      expect(route?.middleware).toContain('getOrders');
    });

    it('should register GET /:orderId (Admin)', () => {
      const route = routes.find(r => r.path === '/:orderId' && r.method === 'get');
      expect(route?.middleware).toContain('resource-read:orders');
      expect(route?.middleware).toContain('getOrder');
    });
  });

  describe('User-Centric Routes (via mountRoute)', () => {
    it('should register GET /user/:userId/orders with isSelf', () => {
      const route = routes.find(r => r.path === '/user/:userId/orders/' && r.method === 'get');
      expect(route?.middleware).toContain('guard-read:orders-self');
      expect(route?.middleware).toContain('getUserOrders');
    });

    it('should register POST /user/:userId/orders with rules and isSelf', () => {
      const route = routes.find(r => r.path === '/user/:userId/orders/' && r.method === 'post');
      expect(route?.middleware).toContain('guard-create:orders-self');
      expect(route?.middleware).toContain('rule-create-order');
      expect(route?.middleware).toContain('createOrder');
    });

    it('should register GET /user/:userId/orders/:orderId with relationship guard', () => {
      const route = routes.find(r => r.path === '/user/:userId/orders/:orderId' && r.method === 'get');
      // Verifies 'userId' field check and 'isSelf' flag
      expect(route?.middleware).toContain('rel-read:orders-userId-self');
      expect(route?.middleware).toContain('getOrder');
    });

    it('should register PUT /user/:userId/orders/:orderId with relationship guard and rules', () => {
      const route = routes.find(r => r.path === '/user/:userId/orders/:orderId' && r.method === 'put');
      expect(route?.middleware).toContain('rel-update:orders-userId-self');
      expect(route?.middleware).toContain('rule-update-order');
      expect(route?.middleware).toContain('updateOrder');
    });
  });
});
