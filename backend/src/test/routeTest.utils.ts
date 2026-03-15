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
export const getRouteStack = (router: Router): RouteDefinition[] => {
  return (router as any).stack.flatMap((layer: any) => {
    const route = layer.route;
    if (!route) {
      return [];
    }

    const path = route.path;
    // Get all methods registered for this path (get, post, delete, etc.)
    const methods = Object.keys(route.methods);

    return methods.map((method) => {
      // For each method, find all middleware associated with it in the route's stack
      const middleware = route.stack
        .filter((s: any) => s.method === method || !s.method)
        .map((s: any) => s.name || s.handle.name || 'anonymous');

      return { path, method, middleware };
    });
  });
};
