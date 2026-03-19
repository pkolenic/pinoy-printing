import { describe, it, expect, vi } from 'vitest';
import { Router } from 'express';
import { getRouteStack } from './test/routeTest.utils';

/**
 * 1. HOISTED HELPER
 * Ensures the mock factory is available before mocks are initialized.
 */
const helper = vi.hoisted(() => ({
  createMockFn: (name: string) => {
    const fn = (_req: any, _res: any, next: any) => next?.();
    Object.defineProperty(fn, 'name', { value: name, configurable: true });
    return fn;
  }
}));

/**
 * 2. MOCK DEPENDENCIES
 * We mock sub-routers and controllers to isolate the routing configuration.
 */
vi.mock('./middleware/index.js', () => ({
  configurationMiddleware: helper.createMockFn('configurationMiddleware'),
}));

vi.mock('./controllers/static.js', () => ({
  getIndex: helper.createMockFn('getIndex'),
  getFavicon: helper.createMockFn('getFavicon'),
  getWellKnownNotFound: helper.createMockFn('getWellKnownNotFound'),
}));

// Mock sub-routers as empty routers
vi.mock('./routes/api.js', () => ({
  default: Router().get('/health', helper.createMockFn('apiHealth'))
}));

vi.mock('./routes/site.js', () => ({
  default: Router().get('/health', helper.createMockFn('siteHealth'))
}));

/**
 * 3. IMPORT ROUTER
 * This must happen after the mocks are defined.
 */
import router from './routes.js';

describe('Main Router Infrastructure', () => {
  // Flatten the stack once for the whole suite
  const routes = getRouteStack(router);

  it('should apply configurationMiddleware globally', () => {
    // Middleware is checked via the stack directly as it doesn't have a specific 'path'
    const hasMiddleware = router.stack.some(layer => layer.name === 'configurationMiddleware');
    expect(hasMiddleware).toBe(true);
  });

  it('should mount sub-routers using mountRoute metadata', () => {
    const apiRoute = routes.find(r => r.path === '/api/health');
    expect(apiRoute).toBeDefined();

    const siteRoute = routes.find(r => r.path === '/site/health');
    expect(siteRoute).toBeDefined();
  });

  it('should register the named 404 handler for .well-known paths', () => {
    // Path in the stack will look like /.well-known/*path
    const route = routes.find(r => r.path === '/.well-known/*path');

    expect(route).toBeDefined();
    expect(route?.method).toBe('get');
    expect(route?.middleware).toContain('getWellKnownNotFound');
  });

  it('should serve all favicon and icon variations via getFavicon', () => {
    // Express joins array paths with commas in the internal stack
    const pathString = '/favicon.ico,/apple-touch-icon.png,apple-touch-icon-precomposed.png';
    const route = routes.find(r => r.path === pathString);

    expect(route, 'Icons route should be registered').toBeDefined();
    expect(route?.method).toBe('get');
    expect(route?.middleware).toContain('getFavicon');
  });

  it('should have a catch-all fallback for React Router using getIndex', () => {
    // Path in the stack will look like /*path
    const route = routes.find(r => r.path === '/*path' && r.method === 'get');

    expect(route).toBeDefined();
    expect(route?.middleware).toContain('getIndex');
  });

  it('should register the express.static middleware', () => {
    // Express names its static middleware 'serveStatic'
    const hasStatic = router.stack.some(layer => layer.name === 'serveStatic');
    expect(hasStatic).toBe(true);
  });
});
