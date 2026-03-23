import { Router } from 'express';

/**
 * Creates a named mock function for Express middleware/controllers.
 * Express relies on the .name property for stack traces.
 */
export const createMockFn = (name: string) => {
  const fn = (_req: any, _res: any, next: any) => {
    if (typeof next === 'function') {
      next();
    }
  };
  Object.defineProperty(fn, 'name', { value: name, configurable: true });
  return fn;
};

export interface RouteDefinition {
  path: string;
  method: string;
  middleware: string[];
}

/**
 * Flattens an Express Router stack into a searchable array of route definitions.
 * Handles both simple routes and router.route() chains.
 */
export const getRouteStack = (router: any, prefix = ''): any[] => {
  if (!router || !router.stack) {
    return [];
  }

  return router.stack.flatMap((layer: any) => {
    // 1. If it's a route (like .get, .post, .route)
    if (layer.route) {
      const routePath = layer.route.path;

      // If it's a string, clean it. If it's a RegExp, keep it as is.
      const path = typeof routePath === 'string'
        ? (prefix + '/' + routePath).replace(/\/+/g, '/')
        : routePath;

      const methods = Object.keys(layer.route.methods);

      return methods.map((method) => {
        const middleware = layer.route.stack
          .map((s: any) => s.name || s.handle.name || 'anonymous');
        return { path, method, middleware };
      });
    }

    // 2. If it's a nested router (router.use)
    if (layer.name === 'router' && layer.handle) {
      // Look for a mountPath property on the layer, or use the path in case Express populated it from a simple string
      const mountPath = layer.handle.mountPath || layer.path || '';
      return getRouteStack(layer.handle, prefix + mountPath);
    }

    return [];
  });
};
