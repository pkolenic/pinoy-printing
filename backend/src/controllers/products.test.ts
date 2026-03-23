import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import { matchedData } from 'express-validator';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as Models from '../models';
import * as Pagination from '../utils/pagination';
import * as QueryHelper from '../utils/controllers/queryHelper';

import {
  createProduct,
  deleteProduct,
  getImportTemplate,
  getProduct,
  getProducts,
  importProducts,
  updateProduct,
} from './products';

// Mock fs
vi.mock('fs', () => {
  // Create a function that generates a stream-like object
  const createMockStream = () => ({
    pipe: vi.fn().mockImplementation((dest) => dest), // <--- THIS IS THE FIX
    on: vi.fn().mockReturnThis(),
  });

  return {
    createReadStream: vi.fn().mockImplementation(createMockStream),
    existsSync: vi.fn().mockReturnValue(true),
    unlinkSync: vi.fn(),
    default: {
      createReadStream: vi.fn().mockImplementation(createMockStream),
      existsSync: vi.fn().mockReturnValue(true),
      unlinkSync: vi.fn(),
    },
  };
});

// Mock csv-parser to just return the stream it is piped into
let activeCsvStream: any;
vi.mock('csv-parser', () => ({
  default: vi.fn(() => activeCsvStream),
}));

// Mock detailedDiff
vi.mock('deep-object-diff', () => ({
  detailedDiff: vi.fn().mockReturnValue({ added: {}, updated: {}, deleted: {} }),
}));

// Mock express-validator
vi.mock('express-validator', () => ({
  matchedData: vi.fn(),
}));

// Mock the model's sanitizeProduct function
vi.mock('../models', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../models')>();
  return {
    ...actual,
    getCommitedStock: vi.fn(),
    getRelatedCategoryIds: vi.fn(),
    resolveCategory: vi.fn(),
    sanitizeProduct: vi.fn(),
  };
});

vi.mock('../utils/pagination.js', () => ({
  paginateResponse: vi.fn((_req, data, count, page, limit) => ({ data, count, page, limit })),
}));

vi.mock('../utils/controllers/queryHelper.js', () => ({
  parsePagination: vi.fn(),
  buildSort: vi.fn(),
}));

// Helper to simulate CSV stream content
const mockCsvStream = (data: any[]) => {
  const s = new Readable({
    objectMode: true,
    read() {
      data.forEach(row => this.push(row));
      this.push(null);
    }
  });
  // Add AsyncIterable support for the 'for await' loop
  (s as any)[Symbol.asyncIterator] = async function* () {
    for (const item of data) yield item;
  };
  return s;
};

describe('Product Controller', () => {
  describe('createProduct', () => {
    let req: any;
    let res: any;
    let next: any;
    let mockProductModel: any;

    beforeEach(() => {
      // Mock Mongoose Model instance & methods
      mockProductModel = vi.fn(function (this: Partial<Models.IProductDocument>, data) {
        this.save = vi.fn().mockResolvedValue(this);
        this.populate = vi.fn().mockResolvedValue(this);
        Object.assign(this, data);
        return this;
      });

      req = {
        tenantModels: { Product: mockProductModel },
        body: {},
      };

      res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };

      next = vi.fn();
    });

    it('should create a product and fallback details to description', async () => {
      const validData = {
        sku: 't-shirt-001',
        name: 'Cool T-Shirt',
        description: 'A very cool shirt',
        price: 20,
        category: 'cat-id-123',
        quantity: 10,
      };

      (matchedData as any).mockReturnValue(validData);

      await createProduct(req, res, next);

      // Verify the model was instantiated with the correct data
      expect(mockProductModel).toHaveBeenCalledWith(expect.objectContaining({
        sku: 't-shirt-001',
        details: 'A very cool shirt', // Fallback triggered
        quantityAvailable: 10,
        quantityOnHand: 10,
      }));

      expect(res.status).toHaveBeenCalledWith(StatusCodes.CREATED);
    });

    it('should call next(error) if saving fails', async () => {
      const error = new Error('DB Error');
      mockProductModel.mockImplementationOnce(function (this: Partial<Models.IProductDocument>) {
        this.save = vi.fn().mockRejectedValue(error);
        this.populate = vi.fn().mockReturnThis();
        return this;
      });

      (matchedData as any).mockReturnValue({});

      await createProduct(req, res, next);
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getProducts', () => {
    let req: any;
    let res: any;
    let next: any;
    let mockProductModel: any;

    beforeEach(() => {
      // Chainable Mongoose Query Mock
      const mockQuery = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        populate: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([{ name: 'Product A' }]),
      };

      mockProductModel = {
        countDocuments: vi.fn().mockResolvedValue(1),
        find: vi.fn().mockReturnValue(mockQuery),
      };

      req = {
        tenantModels: { Product: mockProductModel, Category: {} },
        query: {},
        auth: { payload: { permissions: [] } },
      };

      res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };

      next = vi.fn();

      // Default Mock Returns
      vi.mocked(QueryHelper.parsePagination).mockReturnValue({ limit: 10, page: 1, skip: 0 });
      vi.mocked(QueryHelper.buildSort).mockReturnValue({ name: 1 });
      vi.mocked(Models.sanitizeProduct).mockImplementation((p) => p);

      vi.clearAllMocks();
    });

    it('should default to empty permissions if auth payload is missing', async () => {
      delete req.auth; // Force the || [] branch
      await getProducts(req, res, next);
      expect(Models.sanitizeProduct).toHaveBeenCalledWith(expect.anything(), false);
    });

    it('should return empty pagination early if category slug is invalid', async () => {
      req.query.category = 'fake-category';
      vi.mocked(Models.getRelatedCategoryIds).mockResolvedValue([]);

      await getProducts(req, res, next);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(mockProductModel.find).not.toHaveBeenCalled();
      expect(Pagination.paginateResponse).toHaveBeenCalledWith(req, [], 0, 1, 10);
    });

    it('should filter by category when valid category IDs are found', async () => {
      req.query.category = 'shirts';

      // Create valid ObjectId instances
      const mockIds = [new Types.ObjectId(), new Types.ObjectId()];
      vi.mocked(Models.getRelatedCategoryIds).mockResolvedValue(mockIds);

      await getProducts(req, res, next);

      expect(mockProductModel.find).toHaveBeenCalledWith(expect.objectContaining({
        category: { $in: mockIds }
      }));
    });

    it('should build a filter with both min and max price', async () => {
      req.query = { minPrice: 10, maxPrice: 100 };

      await getProducts(req, res, next);

      expect(mockProductModel.find).toHaveBeenCalledWith(expect.objectContaining({
        price: { $gte: 10, $lte: 100 }
      }));
    });

    it('should build a filter with only minPrice', async () => {
      req.query = { minPrice: 10 };

      await getProducts(req, res, next);

      expect(mockProductModel.find).toHaveBeenCalledWith(expect.objectContaining({
        price: { $gte: 10 }
      }));
      // Ensure $lte is not present
      const queryArg = vi.mocked(mockProductModel.find).mock.calls[0][0];
      expect(queryArg.price).not.toHaveProperty('$lte');
    });

    it('should filter by maxPrice only', async () => {
      req.query = { maxPrice: 100 }; // Test the second half of the spread

      await getProducts(req, res, next);

      expect(mockProductModel.find).toHaveBeenCalledWith(expect.objectContaining({
        price: { $lte: 100 }
      }));
    });

    it('should apply regex search on name and sku', async () => {
      req.query.search = 'denim';

      await getProducts(req, res, next);

      expect(mockProductModel.find).toHaveBeenCalledWith(expect.objectContaining({
        $or: [
          { name: { $regex: 'denim', $options: 'i' } },
          { sku: { $regex: 'denim', $options: 'i' } }
        ]
      }));
    });

    it('should allow inventory-based sorting for staff', async () => {
      req.auth.payload.permissions = ['read:inventory'];
      req.query.sortBy = 'quantityAvailable';

      await getProducts(req, res, next);

      // Verify buildSort was called with staff-allowed fields
      expect(QueryHelper.buildSort).toHaveBeenCalledWith(
        'quantityAvailable',
        expect.arrayContaining(['quantityOnHand', 'quantityAvailable'])
      );
      expect(Models.sanitizeProduct).toHaveBeenCalledWith(expect.anything(), true);
    });

    it('should restrict sorting fields for public users', async () => {
      // 1. Arrange: No inventory permissions in auth payload
      req.auth.payload.permissions = ['read:some-other-permission'];
      req.query.sortBy = 'price';

      // 2. Act
      await getProducts(req, res, next);

      // 3. Assert:
      // We expect buildSort to have been called with:
      // - The user's requested sortBy field
      // - An allowed list that DOES NOT contain inventory fields
      expect(QueryHelper.buildSort).toHaveBeenCalledWith(
        'price',
        expect.not.arrayContaining(['quantityAvailable', 'quantityOnHand'])
      );

      // Double-check the sanitizer also used the public flag
      expect(Models.sanitizeProduct).toHaveBeenCalledWith(expect.anything(), false);
    });

    it('should filter by quantityAvailable when maxInventory is provided', async () => {
      req.query.maxInventory = 20;

      await getProducts(req, res, next);

      expect(mockProductModel.find).toHaveBeenCalledWith(expect.objectContaining({
        quantityAvailable: { $lte: 20 }
      }));
    });

    it('should catch and pass errors to next', async () => {
      const error = new Error('DB Fail');
      mockProductModel.countDocuments.mockRejectedValue(error);

      await getProducts(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getProduct', () => {
    let req: any;
    let res: any;
    let next: any;
    let mockProduct: any;

    beforeEach(() => {
      mockProduct = {
        populate: vi.fn().mockReturnThis(),
        toJSON: vi.fn().mockReturnValue({ name: 'Test Product', sku: '123' }),
      };

      req = {
        product: mockProduct,
        auth: { payload: { permissions: [] } },
      };

      res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };

      next = vi.fn();
      vi.clearAllMocks();
    });

    it('should return sanitized product for public user', async () => {
      // Mock sanitizer return value
      const sanitized = { name: 'Test Product', sku: '123' };
      vi.mocked(Models.sanitizeProduct).mockReturnValue(sanitized as any);

      await getProduct(req, res, next);

      // Verify sanitizer was called with isStaff = false
      expect(Models.sanitizeProduct).toHaveBeenCalledWith(expect.any(Object), false);
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith(sanitized);
    });

    it('should return sanitized product for staff user', async () => {
      req.auth.payload.permissions = ['read:inventory'];

      await getProduct(req, res, next);

      // Verify sanitizer was called with isStaff = true
      expect(Models.sanitizeProduct).toHaveBeenCalledWith(expect.any(Object), true);
    });

    it('should call next with AppError if product is missing', async () => {
      req.product = undefined;

      await getProduct(req, res, next);

      // Check if next was called with an error (adjust based on your AppError implementation)
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Product not found',
        statusCode: StatusCodes.NOT_FOUND
      }));
    });

    it('should call next(error) if product.populate fails', async () => {
      const error = new Error('Population failed');

      // Force the populate method to reject
      mockProduct.populate.mockRejectedValueOnce(error);

      await getProduct(req, res, next);

      // This will verify line 150 is reached
      expect(next).toHaveBeenCalledWith(error);
    });

    it('should default to public access if req.auth is missing', async () => {
      // 1. Scenario: req.auth is undefined
      delete req.auth;

      await getProduct(req, res, next);

      // isStaff should be false because permissions defaulted to []
      expect(Models.sanitizeProduct).toHaveBeenCalledWith(expect.any(Object), false);
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    });

    it('should default to public access if permissions array is missing', async () => {
      // 2. Scenario: req.auth exists, but payload.permissions are undefined
      req.auth = { payload: {} };

      await getProduct(req, res, next);

      // isStaff should be false
      expect(Models.sanitizeProduct).toHaveBeenCalledWith(expect.any(Object), false);
    });
  });

  describe('updateProduct', () => {
    let req: any;
    let res: any;
    let next: any;
    let mockProduct: any;

    beforeEach(() => {
      // We mock the Mongoose document methods
      mockProduct = {
        set: vi.fn().mockReturnThis(),
        save: vi.fn().mockResolvedValue(true),
        populate: vi.fn().mockReturnThis(),
        // Adding a spread of the product to simulate the response
        sku: 'original-sku',
        name: 'Original Name'
      };

      req = {
        product: mockProduct,
      };

      res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };

      next = vi.fn();
      vi.clearAllMocks();
    });

    it('should update product using validated matchedData', async () => {
      const validatedUpdates = { name: 'Validated Shirt', price: 29.99 };
      // Simulate express-validator returning only the clean data
      vi.mocked(matchedData).mockReturnValue(validatedUpdates);

      await updateProduct(req, res, next);

      // Verify the set method was called with the body
      expect(matchedData).toHaveBeenCalledWith(req);
      expect(mockProduct.set).toHaveBeenCalledWith(validatedUpdates);
      // Verify save was called
      expect(mockProduct.save).toHaveBeenCalled();
      // Verify response
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith(mockProduct);
    });

    it('should return 404 if product is missing from request', async () => {
      req.product = undefined;

      await updateProduct(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Product not found',
        statusCode: StatusCodes.NOT_FOUND
      }));
    });

    it('should call next(error) if product.save fails', async () => {
      const error = new Error('Validation Error');
      vi.mocked(matchedData).mockReturnValue({ name: 'fail' });
      mockProduct.save.mockRejectedValueOnce(error);

      await updateProduct(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should call next(error) if populate fails after saving', async () => {
      const error = new Error('Populate Error');
      vi.mocked(matchedData).mockReturnValue({ name: 'fail' });
      mockProduct.populate.mockRejectedValueOnce(error);

      await updateProduct(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteProduct', () => {
    let req: any;
    let res: any;
    let next: any;
    let mockProduct: any;

    beforeEach(() => {
      mockProduct = {
        deleteOne: vi.fn().mockResolvedValue(true),
      };

      req = {
        product: mockProduct,
      };

      res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      };

      next = vi.fn();
      vi.clearAllMocks();
    });

    it('should delete the product and return 204 No Content with no body', async () => {
      await deleteProduct(req, res, next);

      expect(mockProduct.deleteOne).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(StatusCodes.NO_CONTENT);

      // Verify send() was called instead of json()
      expect(res.send).toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should call next with 404 if product is missing', async () => {
      req.product = undefined;

      await deleteProduct(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Product not found',
        statusCode: StatusCodes.NOT_FOUND
      }));
    });

    it('should call next(error) if deleteOne fails', async () => {
      const error = new Error('Database connection lost');
      mockProduct.deleteOne.mockRejectedValueOnce(error);

      await deleteProduct(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('importProducts', () => {
    let req: any;
    let res: any;
    let next: any;
    let mockProductModel: any;

    beforeEach(() => {
      // 1. The Constructor Mock: Handles 'new Product(data)'
      mockProductModel = vi.fn().mockImplementation(function (this: any, data: any) {
        this._id = new Types.ObjectId();
        this.save = vi.fn().mockResolvedValue(this);
        this.validate = vi.fn().mockResolvedValue(this);
        this.set = vi.fn().mockReturnThis();
        this.toObject = vi.fn().mockReturnValue({ ...data, _id: this._id });
        Object.assign(this, data);
        return this;
      }) as any;

      // 2. The Static Mock: Handles 'Product.findOne()'
      mockProductModel.findOne = vi.fn();

      // 3. Request/Response Setup
      req = {
        file: { path: '/tmp/test.csv' },
        query: { preview: 'false', allowUpdate: 'false' },
        tenantModels: {
          Product: mockProductModel,
          Category: {}, // Passed to resolveCategory
          Order: {},    // Passed to getCommitedStock
        },
      };

      res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };

      next = vi.fn();

      // 4. Reset helpers to default successful states
      vi.clearAllMocks();
      vi.mocked(Models.resolveCategory).mockResolvedValue(new Types.ObjectId() as any);
      vi.mocked(Models.getCommitedStock).mockResolvedValue(0);
    });

    it('should return 400 if no file is uploaded', async () => {
      delete req.file;
      await importProducts(req, res, next);
      expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
    });

    it('should create a new product from CSV row', async () => {
      const csvRow = { sku: 'new-sku', name: 'New Item', quantity: '10', category: 'electronics' };

      // PATTERN: Set activeCsvStream
      activeCsvStream = mockCsvStream([csvRow]);

      vi.mocked(Models.resolveCategory).mockResolvedValue(new Types.ObjectId() as any);
      vi.mocked(mockProductModel.findOne).mockResolvedValue(null);

      await importProducts(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        summary: expect.objectContaining({ created: 1 })
      }));
    });

    it('should update an existing product when allowUpdate is true', async () => {
      // 1. Arrange: Setup request and data
      req.query.allowUpdate = 'true';
      const csvRow = {
        sku: 'old-sku',
        name: 'Updated Item',
        quantity: '50',
        price: '25.00'
      };

      // Inject data into the CSV stream
      activeCsvStream = mockCsvStream([csvRow]);

      // Create the mock document that Mongoose would return
      const existingDoc = {
        _id: new Types.ObjectId(),
        sku: 'old-sku',
        set: vi.fn().mockReturnThis(),
        save: vi.fn().mockResolvedValue(true),
        // toObject is used by the controller for diffing
        toObject: vi.fn().mockReturnValue({
          sku: 'old-sku',
          name: 'Old Item',
          category: { _id: 'cat-123' }
        })
      };

      // Setup helper mocks
      vi.mocked(Models.resolveCategory).mockResolvedValue('cat-id-123' as any);
      vi.mocked(mockProductModel.findOne).mockResolvedValue(existingDoc);

      // Set committed stock to 5
      vi.mocked(Models.getCommitedStock).mockResolvedValue(5);

      // 2. Act: Run the controller
      await importProducts(req, res, next);

      // 3. Assert: Verify the logic
      // Extract the data passed to .set()
      const updateData = vi.mocked(existingDoc.set).mock.calls[0][0];

      // Verify the Inventory Math: Physical (50) - Committed (5) = Available (45)
      expect(updateData.quantityOnHand).toBe(50);
      expect(updateData.quantityAvailable).toBe(45);

      // Verify other normalized fields
      expect(updateData.name).toBe('Updated Item');
      expect(updateData.price).toBe(25.00);

      // Ensure a database was actually hit
      expect(existingDoc.save).toHaveBeenCalled();

      // Verify the final response summary
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        summary: expect.objectContaining({ updated: 1, errors: 0 })
      }));
    });

    it('should error if SKU exists but allowUpdate is false', async () => {
      const csvRow = { sku: 'exists', quantity: '10' };

      // PATTERN: Set activeCsvStream
      activeCsvStream = mockCsvStream([csvRow]);

      vi.mocked(Models.resolveCategory).mockResolvedValue('cat-id-123' as any);
      vi.mocked(mockProductModel.findOne).mockResolvedValue({ sku: 'exists' });

      await importProducts(req, res, next);

      const response = vi.mocked(res.json).mock.calls[0][0];
      expect(response.summary.errors).toBe(1);
      expect(response.results[0].error).toContain('updates are disabled');
    });

    it('should run validate() instead of save() in preview mode', async () => {
      req.query.preview = 'true';
      const csvRow = { sku: 'new-item', quantity: '10' };

      // PATTERN: Set activeCsvStream
      activeCsvStream = mockCsvStream([csvRow]);

      vi.mocked(Models.resolveCategory).mockResolvedValue(new Types.ObjectId() as any);
      vi.mocked(mockProductModel.findOne).mockResolvedValue(null);

      await importProducts(req, res, next);

      // Use .at(-1) to get the most recent instance if multiple rows were processed
      const productInstances = vi.mocked(mockProductModel).mock.results;
      const lastInstance = productInstances[productInstances.length - 1].value;

      expect(lastInstance.validate).toHaveBeenCalled();
      expect(lastInstance.save).not.toHaveBeenCalled();
    });

    it('should not call save() on existing product in preview mode', async () => {
      req.query.preview = 'true';
      req.query.allowUpdate = 'true';
      const csvRow = { sku: 'existing-sku', name: 'Preview Update' };
      activeCsvStream = mockCsvStream([csvRow]);

      const existingDoc = {
        _id: new Types.ObjectId(),
        set: vi.fn(),
        save: vi.fn(),
        toObject: vi.fn().mockReturnValue({ sku: 'existing-sku' })
      };
      vi.mocked(mockProductModel.findOne).mockResolvedValue(existingDoc);

      await importProducts(req, res, next);

      expect(existingDoc.set).not.toHaveBeenCalled();
      expect(existingDoc.save).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ isPreview: true }));
    });

    it('should handle JSON parse errors in customizationSchema', async () => {
      const csvRow = { sku: 'json-fail', customizationSchema: '{ invalid json }' };

      // PATTERN: Set activeCsvStream
      activeCsvStream = mockCsvStream([csvRow]);

      vi.mocked(Models.resolveCategory).mockResolvedValue('cat-id-123' as any);

      await importProducts(req, res, next);

      expect(vi.mocked(res.json).mock.calls[0][0].summary.errors).toBe(1);
      expect(vi.mocked(res.json).mock.calls[0][0].results[0].status).toBe('error');
    });

    it('should record an error if resolveCategory returns null', async () => {
      const csvRow = { sku: 'cat-fail', category: 'invalid-category' };
      activeCsvStream = mockCsvStream([csvRow]);

      // Force resolveCategory to return null
      vi.mocked(Models.resolveCategory).mockResolvedValue(null as any);

      await importProducts(req, res, next);

      const response = vi.mocked(res.json).mock.calls[0][0];
      expect(response.summary.errors).toBe(1);
      expect(response.results[0].error).toContain('Category not found');
    });

    it('should catch row-level errors and continue processing other rows', async () => {
      const row1 = { sku: 'row-1', quantity: '10' };
      const row2 = { sku: 'row-2', quantity: '20' };
      activeCsvStream = mockCsvStream([row1, row2]);

      // Force row 1 to throw an error during the findOne call
      vi.mocked(mockProductModel.findOne)
        .mockRejectedValueOnce(new Error('Row 1 DB Fail'))
        .mockResolvedValueOnce(null); // Row 2 succeeds

      await importProducts(req, res, next);

      const response = vi.mocked(res.json).mock.calls[0][0];
      expect(response.summary.errors).toBe(1);
      expect(response.summary.created).toBe(1); // Proves it continued to row 2
    });

    it('should call next(error) if the stream itself fails', async () => {
      const error = new Error('Stream corruption');

      // TARGET THE DEFAULT EXPORT: This is what the controller uses
      // Use (fs as any) to bypass the type check
      vi.mocked((fs as any).default.createReadStream).mockImplementationOnce(() => {
        throw error;
      });

      await importProducts(req, res, next);

      // Now next should be called with the corruption error
      expect(next).toHaveBeenCalledWith(error);
    });

    it('should skip unlinking if the file does not exist in finally block', async () => {
      // 1. Setup empty data
      activeCsvStream = mockCsvStream([]);

      // 2. TARGET THE DEFAULT EXPORT: Tell the controller the file is missing
      vi.mocked((fs as any).default.existsSync).mockReturnValueOnce(false);

      await importProducts(req, res, next);

      // 3. Assertions
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);

      // Verify the default unlinkSync was not called
      expect((fs as any).default.unlinkSync).not.toHaveBeenCalled();
    });
  });

  describe('getImportTemplate', () => {
    let req: any;
    let res: any;
    let next: any;

    beforeEach(() => {
      req = {};
      res = {
        setHeader: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      };
      next = vi.fn();
      vi.clearAllMocks();
    });

    it('should set the correct CSV headers and return the template content', () => {
      getImportTemplate(req, res, next);

      // 1. Verify Response Headers (Content-Type and Attachment)
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename=product_import_template.csv'
      );

      // 2. Verify Status Code
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);

      // 3. Verify the CSV Content
      // It should join the headers from your Models file with a newline
      const expectedCsv = Models.CSV_PRODUCT_HEADERS.join(',') + '\n';
      expect(res.send).toHaveBeenCalledWith(expectedCsv);
    });
  });
});
