import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import * as Models from '../models';
import * as QueryHelper from '../utils/controllers/queryHelper';
import { AppError } from '../utils/errors';

import {
  createCategory,
  deleteCategory,
  getCategories,
  getCategory,
  getCategoryTree,
  updateCategory,
} from './categories';

vi.mock('../utils/pagination.js', () => ({
  paginateResponse: vi.fn((_req, data, count, page, limit) => ({ data, count, page, limit })),
}));

vi.mock('../utils/controllers/queryHelper.js', () => ({
  parsePagination: vi.fn(),
  buildSort: vi.fn(),
}));

describe('Category Controller', () => {
  describe('createCategory', () => {
    let req: any;
    let res: any;
    let next: any;
    let mockCategoryModel: any;

    beforeEach(() => {
      vi.clearAllMocks();

      // Mock Mongoose Model instance & methods (matching your createProduct style)
      mockCategoryModel = vi.fn().mockImplementation(function (this: Partial<Models.ICategoryDocument>, data) {
        Object.assign(this, data);
        this.save = vi.fn().mockResolvedValue(this);
        return this;
      });

      req = {
        tenantModels: { Category: mockCategoryModel },
        tenantRedis: {
          del: vi.fn().mockResolvedValue(1),
        },
        body: {
          name: 'Electronics',
          parent: 'parent-id-123'
        },
      };

      res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };

      next = vi.fn();
    });

    it('should create a category, clear cache, and return 201', async () => {
      await createCategory(req, res, next);

      // Verify the model was instantiated with the correct data
      expect(mockCategoryModel).toHaveBeenCalledWith({
        name: 'Electronics',
        parent: 'parent-id-123',
      });

      // Verify Redis cache invalidation (specific to your Category logic)
      expect(req.tenantRedis.del).toHaveBeenCalledWith('category_tree');

      expect(res.status).toHaveBeenCalledWith(StatusCodes.CREATED);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Electronics'
      }));
    });

    it('should call next(error) if saving fails', async () => {
      const error = new Error('DB Error');

      // Override the implementation for this specific test to throw
      mockCategoryModel.mockImplementationOnce(function (this: Partial<Models.ICategoryDocument>) {
        this.save = vi.fn().mockRejectedValue(error);
        return this;
      });

      await createCategory(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('getCategories', () => {
    let req: any;
    let res: any;
    let next: any;
    let mockCategoryModel: any;
    let mockQuery: any;

    beforeEach(() => {
      // 1. Setup a chainable mock query object
      mockQuery = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn(),
      };

      // 2. Set up the Model with countDocuments and find
      mockCategoryModel = {
        countDocuments: vi.fn(),
        find: vi.fn().mockReturnValue(mockQuery),
      };

      req = {
        tenantModels: { Category: mockCategoryModel },
        query: { page: '1', limit: '10' },
      };

      res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };

      next = vi.fn();

      // 3. Mock the Query Helpers (matching your Product test setup)
      vi.mocked(QueryHelper.parsePagination).mockReturnValue({ limit: 10, page: 1, skip: 0 });
    });

    it('should return paginated categories with 200 OK', async () => {
      const mockCategories = [{ name: 'Electronics', path: 'electronics' }];
      const mockCount = 1;

      // Set up the mock resolutions
      mockCategoryModel.countDocuments.mockResolvedValue(mockCount);
      mockQuery.lean.mockResolvedValue(mockCategories);

      await getCategories(req, res, next);

      // Verify the query chain was called correctly
      expect(mockCategoryModel.find).toHaveBeenCalledWith({});
      expect(mockQuery.sort).toHaveBeenCalledWith({ path: 'asc' });
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
      expect(mockQuery.lean).toHaveBeenCalled();

      // Verify response
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      // paginateResponse mock from your Product tests will return this structure
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        data: mockCategories,
        count: mockCount
      }));
    });

    it('should call next(error) if a database operation fails', async () => {
      const error = new Error('Database Error');
      mockCategoryModel.countDocuments.mockRejectedValue(error);

      await getCategories(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getCategory', () => {
    let req: any;
    let res: any;
    let next: any;

    beforeEach(() => {
      vi.clearAllMocks();

      req = {
        category: null,
      };

      res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };

      next = vi.fn();
    });

    it('should return 200 OK and the category if it exists on req', async () => {
      const mockCategory = { _id: 'cat-123', name: 'Electronics' };
      req.category = mockCategory;

      await getCategory(req, res, next);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith(mockCategory);
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next with AppError 404 if category is missing from req', async () => {
      req.category = undefined;

      await getCategory(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(StatusCodes.NOT_FOUND);
      expect(error.message).toBe('Category not found');
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should catch unexpected errors and pass them to next', async () => {
      // Simulate a crash by making the status call throw
      res.status.mockImplementationOnce(() => {
        throw new Error('Unexpected Crash');
      });
      req.category = { name: 'Test' };

      await getCategory(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('Unexpected Crash');
    });
  });

  describe('updateCategory', () => {
    let req: any;
    let res: any;
    let next: any;
    let mockCategoryModel: any;
    let mockCategoryInstance: any;

    beforeEach(() => {
      vi.clearAllMocks();

      // 1. Mock the specific category instance found on req
      mockCategoryInstance = {
        _id: new Types.ObjectId(),
        name: 'Old Name',
        path: 'electronics',
        parent: new Types.ObjectId(),
        set: vi.fn(),
        save: vi.fn().mockResolvedValue(this),
      };

      // 2. Mock the Category Model for lookups
      mockCategoryModel = {
        findById: vi.fn().mockReturnValue({
          lean: vi.fn(),
        }),
      };

      req = {
        category: mockCategoryInstance,
        tenantModels: { Category: mockCategoryModel },
        tenantRedis: { del: vi.fn().mockResolvedValue(1) },
        body: {},
      };

      res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };

      next = vi.fn();
    });

    it('should update name and parent, clear cache, and return 200', async () => {
      const newParentId = new Types.ObjectId();
      req.body = { name: 'New Name', parent: newParentId.toString() };

      // Mock the potential parent check (not a descendant)
      vi.mocked(mockCategoryModel.findById().lean).mockResolvedValue({ path: 'other-root' });

      await updateCategory(req, res, next);

      expect(mockCategoryInstance.name).toBe('New Name');
      expect(mockCategoryInstance.set).toHaveBeenCalledWith('parent', expect.any(Types.ObjectId));
      expect(mockCategoryInstance.save).toHaveBeenCalled();
      expect(req.tenantRedis.del).toHaveBeenCalledWith('category_tree');
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    });

    it('should return 400 if category tries to be its own parent', async () => {
      const id = mockCategoryInstance._id.toString();
      req.body = { parent: id };

      await updateCategory(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(next.mock.calls[0][0].message).toContain('cannot be its own parent');
    });

    it('should return 400 if moving under a descendant', async () => {
      const descendantId = new Types.ObjectId();
      req.body = { parent: descendantId.toString() };

      // Mock a potential parent as a descendant (path starts with the current path)
      vi.mocked(mockCategoryModel.findById().lean).mockResolvedValue({
        path: `${mockCategoryInstance.path}/sub-item`
      });

      await updateCategory(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toContain('cannot have its own descendant');
    });

    it('should allow moving to root by setting parent to null', async () => {
      req.body = { parent: null };

      await updateCategory(req, res, next);

      expect(mockCategoryInstance.parent).toBeNull();
      expect(mockCategoryInstance.save).toHaveBeenCalled();
    });

    it('should return 400 for invalid parent ID format', async () => {
      req.body = { parent: 'not-a-valid-id' };

      await updateCategory(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe('Invalid parent ID format');
    });

    it('should return 404 if category is missing from req', async () => {
      req.category = null; // Hits line 210-211

      await updateCategory(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(StatusCodes.NOT_FOUND);
    });

    it('should skip parent and name logic if they are not in req.body', async () => {
      req.body = {}; // Hits "else" branches for lines 215 and 238

      await updateCategory(req, res, next);

      expect(mockCategoryInstance.set).not.toHaveBeenCalled();
      expect(mockCategoryInstance.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    });

    it('should proceed if potentialParent is not found (null)', async () => {
      req.body = { parent: new Types.ObjectId().toString() };
      // Mock findById to return null (Hits the potentialParent? optional chain at line 228)
      mockCategoryModel.findById().lean.mockResolvedValue(null);

      await updateCategory(req, res, next);

      expect(mockCategoryInstance.set).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    });

    it('should catch and pass errors to next()', async () => {
      req.body = { name: 'New Name' };
      const error = new Error('Save Failed');
      mockCategoryInstance.save.mockRejectedValue(error); // Hits lines 249-250

      await updateCategory(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteCategory', () => {
    let req: any;
    let res: any;
    let next: any;
    let mockProductModel: any;
    let mockCategoryInstance: any;

    beforeEach(() => {
      vi.clearAllMocks();

      // 1. Mock the specific category instance found on req
      mockCategoryInstance = {
        _id: new Types.ObjectId(),
        get: vi.fn().mockReturnValue('parent-id-123'), // Mocking .get('parent')
        deleteOne: vi.fn().mockResolvedValue({}),
      };

      // 2. Mock the Product model for cleanup
      mockProductModel = {
        updateMany: vi.fn().mockResolvedValue({ acknowledged: true }),
      };

      req = {
        category: mockCategoryInstance,
        tenantModels: { Product: mockProductModel },
        tenantRedis: {
          del: vi.fn().mockResolvedValue(1),
        },
      };

      res = {
        status: vi.fn().mockReturnThis(),
        end: vi.fn().mockReturnThis(),
      };

      next = vi.fn();
    });

    it('should cleanup products, delete category, clear cache, and return 204', async () => {
      await deleteCategory(req, res, next);

      // Verify Product cleanup called with the correct logic
      expect(mockProductModel.updateMany).toHaveBeenCalledWith(
        { category: mockCategoryInstance._id },
        { $set: { category: 'parent-id-123' } }
      );

      // Verify the category itself was deleted
      expect(mockCategoryInstance.deleteOne).toHaveBeenCalled();

      // Verify cache purge
      expect(req.tenantRedis.del).toHaveBeenCalledWith('category_tree');

      // Verify 204 Response
      expect(res.status).toHaveBeenCalledWith(StatusCodes.NO_CONTENT);
      expect(res.end).toHaveBeenCalled();
    });

    it('should return 404 if category is missing from req', async () => {
      req.category = null;

      await deleteCategory(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(StatusCodes.NOT_FOUND);
    });

    it('should call next(error) if product cleanup fails', async () => {
      const error = new Error('Database Error');
      mockProductModel.updateMany.mockRejectedValue(error);

      await deleteCategory(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('getCategoryTree', () => {
    let req: any;
    let res: any;
    let next: any;
    let mockCategoryModel: any;
    let mockQuery: any;

    beforeEach(() => {
      vi.clearAllMocks();

      mockQuery = {
        select: vi.fn().mockReturnThis(),
        lean: vi.fn(),
      };

      mockCategoryModel = {
        find: vi.fn().mockReturnValue(mockQuery),
      };

      req = {
        tenantModels: { Category: mockCategoryModel },
        tenantRedis: {
          getJSON: vi.fn(),
          setJSON: vi.fn().mockResolvedValue('OK'),
        },
      };

      res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };

      next = vi.fn();
    });

    it('should return cached tree if it exists in Redis', async () => {
      const mockCachedTree = [{ id: '1', name: 'Electronics', children: [] }];
      req.tenantRedis.getJSON.mockResolvedValue(mockCachedTree);

      await getCategoryTree(req, res, next);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith(mockCachedTree);
      // Ensure DB was NOT queried
      expect(mockCategoryModel.find).not.toHaveBeenCalled();
    });

    it('should fetch from DB, build tree, and cache it on a miss', async () => {
      req.tenantRedis.getJSON.mockResolvedValue(null);

      const rootId = new Types.ObjectId();
      const childId = new Types.ObjectId();

      const flatCategories = [
        { _id: rootId, name: 'Electronics', parent: null },
        { _id: childId, name: 'Phones', parent: rootId },
      ];

      mockQuery.lean.mockResolvedValue(flatCategories);

      await getCategoryTree(req, res, next);

      // Verify tree structure
      const expectedTree = [
        expect.objectContaining({
          id: rootId.toString(),
          name: 'Electronics',
          children: [
            expect.objectContaining({
              id: childId.toString(),
              name: 'Phones',
            }),
          ],
        }),
      ];

      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith(expectedTree);

      // Verify it was cached in Redis
      expect(req.tenantRedis.setJSON).toHaveBeenCalledWith(
        'category_tree',
        expectedTree,
        3600 // CATEGORY_CACHE_TTL
      );
    });

    it('should handle items with missing parent in map as root nodes', async () => {
      req.tenantRedis.getJSON.mockResolvedValue(null);

      // Parent ID exists but isn't in the returned list (orphaned or filtered)
      const orphanId = new Types.ObjectId();
      const flatCategories = [
        { _id: orphanId, name: 'Orphan', parent: new Types.ObjectId() },
      ];

      mockQuery.lean.mockResolvedValue(flatCategories);

      await getCategoryTree(req, res, next);

      // Should be pushed to a root tree because parentId is not in categoryMap
      expect(res.json).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'Orphan' })
      ]);
    });

    it('should catch errors and pass to next()', async () => {
      req.tenantRedis.getJSON.mockRejectedValue(new Error('Redis Down'));

      await getCategoryTree(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
