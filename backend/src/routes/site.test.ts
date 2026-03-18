import { describe, it, expect, vi } from 'vitest';

/**
 * 1. MOCK CONTROLLERS
 * We use a named function so Express/getRouteStack can find it by name.
 */
vi.mock('../controllers/site.js', () => ({
  // The function name here is what getRouteStack will see
  getSiteConfiguration: function getSiteConfiguration() {},
}));

/**
 * 2. MOCK UTILS
 */
vi.mock('../utils/routeGuards.js', () => ({
  createRouteGuards: vi.fn(),
}));

/**
 * 3. NORMAL IMPORTS
 */
import router from './site.js';
import { getRouteStack } from '../test/routeTest.utils.js';

describe('Site Routes', () => {
  const routes = getRouteStack(router);

  it('should register GET /config with the correct controller', () => {
    const route = routes.find(r => r.path === '/config' && r.method === 'get');

    expect(route, 'Route GET /config not found').toBeDefined();

    // Now this will correctly find "getSiteConfiguration" instead of "mock"
    expect(route?.middleware).toContain('getSiteConfiguration');
    expect(route?.middleware.length).toBe(1);
  });
});
