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
      guard: vi.fn((perm, rules = []) => [helper.createMockFn(`guard-${perm}`), ...rules]),
      guardedResource: vi.fn((perm, rules = []) => [helper.createMockFn(`resource-${perm}`), ...rules]),
    })),
  };
});

/**
 * 3. MOCK CONTROLLERS
 */
vi.mock('../controllers/categories.js', () => ({
  createCategory: helper.createMockFn('createCategory'),
  deleteCategory: helper.createMockFn('deleteCategory'),
  getCategory: helper.createMockFn('getCategory'),
  getCategories: helper.createMockFn('getCategories'),
  getCategoryTree: helper.createMockFn('getCategoryTree'),
  updateCategory: helper.createMockFn('updateCategory'),
}));

/**
 * 4. MOCK RULES
 */
vi.mock('../middleware/index.js', () => ({
  createCategoryRules: [helper.createMockFn('rule-create')],
  updateCategoryRules: [helper.createMockFn('rule-update')],
}));

/**
 * 5. NORMAL IMPORTS
 */
import router from './categories.js'; // this triggers the route registration
import { getRouteStack } from '../test/routeTest.utils.js';

describe('Category Routes', () => {
  // We inspect the stack of the Express router using the shared helper
  // to flatten the Express stack to see what was registered
  const routes = getRouteStack(router);

  it('should register GET / with read permissions AND the correct controller', () => {
    const route = routes.find(r => r.path === '/' && r.method === 'get');
    expect(route, 'Route GET / not found').toBeDefined();

    // Verify the Guard
    expect(route?.middleware).toContain('guard-read:categories');
    // Verify Controller
    expect(route?.middleware).toContain('getCategories');
  });

  it('should register POST / with create rules, permissions, and controller', () => {
    const route = routes.find(r => r.path === '/' && r.method === 'post');
    expect(route, 'Route POST / not found').toBeDefined();

    // Verify the Guard
    expect(route?.middleware).toContain('guard-create:categories');
    // Verify the Rules
    expect(route?.middleware).toContain('rule-create');
    // Verify the Controller
    expect(route?.middleware).toContain('createCategory');
  });

  it('should register GET /tree with an empty permission string, and controller', () => {
    const route = routes.find(r => r.path === '/tree' && r.method === 'get');
    expect(route, 'Route GET /tree not found').toBeDefined();

    // Verify the Permissions
    expect(route?.middleware).toContain('guard-');
    // Verify the Controller
    expect(route?.middleware).toContain('getCategoryTree');
  });

  it('should register GET /:categoryId as a guarded resource with controller', () => {
    const route = routes.find(r => r.path === '/:categoryId' && r.method === 'get');
    expect(route, 'Route GET /:categoryId not found').toBeDefined();

    // Verify the Resource Guard
    expect(route?.middleware).toContain('resource-read:categories');
    // Verify the Controller
    expect(route?.middleware).toContain('getCategory');
  });

  it('should register DELETE /:categoryId with delete permissions and controller', () => {
    const route = routes.find(r => r.path === '/:categoryId' && r.method === 'delete');
    expect(route, 'Route DELETE /:categoryId not found').toBeDefined();

    // Verify the Resource Guard
    expect(route?.middleware).toContain('resource-delete:categories');
    // Verify the Controller
    expect(route?.middleware).toContain('deleteCategory');
  });

  it('should register PUT /:categoryId with update rules and controller', () => {
    const route = routes.find(r => r.path === '/:categoryId' && r.method === 'put');
    expect(route, 'Route PUT /:categoryId not found').toBeDefined();

    // Verify the Resource Guard
    expect(route?.middleware).toContain('resource-update:categories');
    // Verify the Rules
    expect(route?.middleware).toContain('rule-update');
    // Verify the Controller
    expect(route?.middleware).toContain('updateCategory');
  });
});
