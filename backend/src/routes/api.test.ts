import { describe, it, expect, vi } from 'vitest';

/**
 * 1. HOIST the mock factory function.
 * This ensures the function exists BEFORE the vi.mock calls run.
 */
const helper = vi.hoisted(() => ({
  mockRouter: (path: string) => {
    const fn = vi.fn();
    // getRouteStack looks for layer.name === 'router'
    Object.defineProperty(fn, 'name', { value: 'router' });
    (fn as any).mountPath = path;
    (fn as any).stack = [];
    return fn;
  }
}));

/**
 * 2. MOCK SUB-ROUTERS
 * Now we can safely use helper.mockRouter because it was hoisted.
 */
vi.mock('./categories.js', () => ({ default: helper.mockRouter('/categories') }));
vi.mock('./orders.js', () => ({ default: helper.mockRouter('/orders') }));
vi.mock('./products.js', () => ({ default: helper.mockRouter('/products') }));
vi.mock('./users.js', () => ({ default: helper.mockRouter('/users') }));

/**
 * 3. NORMAL IMPORTS
 */
import router from './api.js';
import { getRouteStack } from '../test/routeTest.utils.js';

describe('Main API Router', () => {
  const routes = getRouteStack(router);

  describe('Sub-Router Mounting', () => {
    // Directly inspect the stack for explicit mount point verification
    const mountedPaths = (router as any).stack
      .filter((layer: any) => layer.name === 'router')
      .map((layer: any) => layer.handle.mountPath);

    it('should mount category routes at /categories', () => {
      expect(mountedPaths).toContain('/categories');
    });

    it('should mount order routes at /orders', () => {
      expect(mountedPaths).toContain('/orders');
    });

    it('should mount product routes at /products', () => {
      expect(mountedPaths).toContain('/products');
    });

    it('should mount user routes at /users', () => {
      expect(mountedPaths).toContain('/users');
    });
  });

  it('should register the Root GET / route', () => {
    const rootRoute = routes.find(r => r.path === '/' && r.method === 'get');
    expect(rootRoute).toBeDefined();
    expect(rootRoute?.middleware).toBeDefined();
  });

  it('should return a 200 status and the correct JSON message from the root route', async () => {
    // 1. Find the root route in the stack
    const layer = (router as any).stack.find((l: any) => l.route?.path === '/' && l.route?.methods.get);
    const handler = layer.route.stack[0].handle; // The anonymous (req, res) function

    // 2. Create mock Express objects
    const mockReq = { auth: { sub: '123' } } as any;
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    } as any;

    // 3. Manually execute the controller
    await handler(mockReq, mockRes);

    // 4. Verify the response (Line 20-23 coverage)
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'API is working!',
      authStatus: true
    }));
  });
});