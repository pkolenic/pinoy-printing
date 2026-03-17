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

// Mock Multer
vi.mock('multer', () => ({
  default: vi.fn(() => ({
    single: vi.fn(() => helper.createMockFn('multer-single')),
  })),
}));

/**
 * 3. MOCK CONTROLLERS
 */
vi.mock('../controllers/products.js', () => ({
  createProduct: helper.createMockFn('createProduct'),
  getProduct: helper.createMockFn('getProduct'),
  getProducts: helper.createMockFn('getProducts'),
  updateProduct: helper.createMockFn('updateProduct'),
  deleteProduct: helper.createMockFn('deleteProduct'),
  importProducts: helper.createMockFn('importProducts'),
  getImportTemplate: helper.createMockFn('getImportTemplate'),
}));

/**
 * 4. MOCK RULES
 */
vi.mock('../middleware/index.js', () => ({
  createProductRules: [helper.createMockFn('rule-create-prod')],
  updateProductRules: [helper.createMockFn('rule-update-prod')],
  importProductRules: [helper.createMockFn('rule-import-prod')],
}));

/**
 * 5. NORMAL IMPORTS
 */
import router from './products.js';
import { getRouteStack } from '../test/routeTest.utils.js';

describe('Product Routes', () => {
  const routes = getRouteStack(router);

  it('should register GET /import/template with create:products', () => {
    const route = routes.find(r => r.path === '/import/template' && r.method === 'get');
    expect(route?.middleware).toContain('guard-create:products');
    expect(route?.middleware).toContain('getImportTemplate');
  });

  it('should register POST / with rules and guard', () => {
    const route = routes.find(r => r.path === '/' && r.method === 'post');
    expect(route?.middleware).toContain('guard-create:products');
    expect(route?.middleware).toContain('rule-create-prod');
    expect(route?.middleware).toContain('createProduct');
  });

  it('should register POST /import with multer and import rules', () => {
    const route = routes.find(r => r.path === '/import' && r.method === 'post');
    expect(route?.middleware).toContain('guard-create:products');
    expect(route?.middleware).toContain('multer-single');
    expect(route?.middleware).toContain('rule-import-prod');
    expect(route?.middleware).toContain('importProducts');
  });

  it('should register GET /:productId with an empty permission (public read)', () => {
    const route = routes.find(r => r.path === '/:productId' && r.method === 'get');
    expect(route?.middleware).toContain('resource-');
    expect(route?.middleware).toContain('getProduct');
  });

  it('should register PUT /:productId with update permissions and rules', () => {
    const route = routes.find(r => r.path === '/:productId' && r.method === 'put');
    expect(route?.middleware).toContain('resource-update:products');
    expect(route?.middleware).toContain('rule-update-prod');
    expect(route?.middleware).toContain('updateProduct');
  });
});