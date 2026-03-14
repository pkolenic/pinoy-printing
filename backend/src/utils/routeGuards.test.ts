import { vi, describe, it, expect } from 'vitest';
import { createRouteGuards } from './routeGuards.js';

// Mock the middleware imports
vi.mock('../middleware/index.js', () => ({
  jwtCheck: { name: 'jwtCheck' }, // Mocking as an object to identify it easily
  checkPermissions: vi.fn((perm, isSelf) => ({ name: 'checkPermissions', perm, isSelf })),
  createAttachMiddleware: vi.fn((model, param, key) => ({ name: 'attach', model, param, key })),
}));

import { checkPermissions, createAttachMiddleware, jwtCheck } from '../middleware';

describe('Route Guards Utility', () => {
  const guards = createRouteGuards<'read' | 'write', 'Category'>(
    'Category',
    'id',
    'category'
  );

  describe('guard', () => {
    it('should assemble basic JWT, permission, and custom rules', () => {
      const customRule = { name: 'customValidation' } as any;
      const result = guards.guard('read', [customRule]);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(jwtCheck);
      expect(checkPermissions).toHaveBeenCalledWith('read', false);
      expect(result[1]).toEqual(checkPermissions('read', false));
      expect(result[2]).toBe(customRule);
    });

    it('should handle the isSelf flag correctly', () => {
      guards.guard('write', [], true);
      expect(checkPermissions).toHaveBeenCalledWith('write', true);
    });

    it('should work with no rules provided (using default empty array)', () => {
      // Call with only the permission string
      const result = guards.guard('read');

      // Should only have: [jwtCheck, checkPermissions]
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(jwtCheck);
      expect(result[1]).toEqual(checkPermissions('read', false));

      // Verify no "undefined" or "null" elements snuck in from the spread operator
      expect(result.every(item => item !== undefined)).toBe(true);
    });

    it('should correctly handle an explicit empty array for rules', () => {
      const result = guards.guard('read', []);
      expect(result).toHaveLength(2);
    });
  });

  describe('guardedResource', () => {
    it('should include the resource attachment middleware at the end', () => {
      const result = guards.guardedResource('write');

      // Index 0: jwt, 1: perm, 2: attach
      expect(result).toHaveLength(3);
      expect(createAttachMiddleware).toHaveBeenCalledWith('Category', 'id', 'category');
      expect(result[2]).toEqual(createAttachMiddleware('Category', 'id', 'category'));
    });

    it('should pass undefined to attach middleware if factory defaults are missing', () => {
      // Factory with NO defaults provided
      const thinGuards = createRouteGuards<'read', 'Category'>('Category');

      thinGuards.guardedResource('read');

      // Verify that it still "works" but passes undefined (as per your ! assertion)
      expect(createAttachMiddleware).toHaveBeenCalledWith('Category', undefined, undefined);
    });
  });

  describe('guardedMultiResource', () => {
    type MockMiddleware = {
      name: string;
      perm?: string;
      isSelf?: boolean;
      model?: string;
      param?: string;
      key?: string;
    };

    it('should attach multiple resources in the order provided', () => {
      const attachments = [
        { modelName: 'Product' as any, param: 'prodId', key: 'product' },
        { modelName: 'User' as any, param: 'userId', key: 'profile' }
      ];

      const result = guards.guardedMultiResource('read', attachments) as unknown as MockMiddleware[];

      // 1 (JWT) + 1 (Perm) + 2 (Attaches) = 4 total
      expect(result).toHaveLength(4);

      // JWT and Permission checks (Indices 0 and 1)
      expect(result[0].name).toBe('jwtCheck');
      expect(result[1].name).toBe('checkPermissions');

      // Attachment checks (Indices 2 and 3)
      expect(createAttachMiddleware).toHaveBeenCalledWith('Product', 'prodId', 'product');
      expect(createAttachMiddleware).toHaveBeenCalledWith('User', 'userId', 'profile');

      expect(result[2].name).toBe('attach');
      expect(result[2].model).toBe('Product');

      expect(result[3].name).toBe('attach');
      expect(result[3].model).toBe('User');
    });
  });
});