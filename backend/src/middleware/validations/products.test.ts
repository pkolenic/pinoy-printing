import {
  vi,
  describe,
  it,
  expect,
  beforeEach,
} from 'vitest';
import { Readable } from 'node:stream';
import { validationResult } from 'express-validator';
import { validate, createValidationTester } from "../../test/validations.utils";
import { StatusCodes } from "http-status-codes";
import {
  createProductRules,
  updateProductRules,
  importProductRules,
} from './products.js';
import { CSV_PRODUCT_HEADERS } from "../../models";

import fs from 'fs';
import readline from 'readline/promises';

// MOCK fs
vi.mock('fs');

const VALID_CATEGORY_ID = '60d5ec1234567890abcdef12';
const VALID_PRODUCT = {
  name: 'Mechanical Keyboard',
  sku: 'KB-123',
  description: 'A clicky mechanical keyboard',
  price: 29.99,
  category: VALID_CATEGORY_ID
};

describe('Product Validation Rules', () => {
  describe('createProductRules', () => {
    it('should fail if required fields are missing', async () => {
      const req = await validate(createProductRules, {});
      const result = validationResult(req);
      const errors = result.array();

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'name', msg: 'Product name is required' }),
          expect.objectContaining({ path: 'sku', msg: 'Product SKU is required' }),
          expect.objectContaining({ path: 'description', msg: 'Description is required' }),
          expect.objectContaining({ path: 'price', msg: 'Price is required' }),
          expect.objectContaining({ path: 'category', msg: 'Category is required' }),
        ])
      );
    });

    it('should fail if price is negative', async () => {
      const req = await validate(createProductRules, { ...VALID_PRODUCT, price: -5 });
      const result = validationResult(req);
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Price must be a positive number' })
        ])
      );
    });

    it('should fail if category is not a valid MongoID', async () => {
      const req = await validate(createProductRules, { ...VALID_PRODUCT, category: 'bad-id' });
      const result = validationResult(req);
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Category must be a valid category ID' })
        ])
      );
    });

    it('should fail if image extension is invalid', async () => {
      const req = await validate(createProductRules, {
        ...VALID_PRODUCT,
        image: 'photo.exe'
      });
      const result = validationResult(req);
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Image must be a valid path ending in jpg, png, webp, or gif' })
        ])
      );
    });

    it('should fail if quantity is negative', async () => {
      const req = await validate(createProductRules, { ...VALID_PRODUCT, quantity: -1 });
      const result = validationResult(req);
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Quantity must be zero or greater' })
        ])
      );
    });

    it('should pass with valid data and optional fields', async () => {
      const req = await validate(createProductRules, {
        ...VALID_PRODUCT,
        quantity: 10,
        image: 'keyboard.png',
        details: 'Full RGB lighting with brown switches.',
        customizationSchema: { layout: 'ISO' }
      });
      const result = validationResult(req);
      expect(result.isEmpty()).toBe(true);
    });
  });

  describe('updateProductRules', () => {
    it('should pass with only one field (all are optional)', async () => {
      const req = await validate(updateProductRules, { price: 50 });
      const result = validationResult(req);
      expect(result.isEmpty()).toBe(true);
    });

    it('should still run validations if an optional field is provided', async () => {
      const req = await validate(updateProductRules, { sku: '' }); // SKU is provided but empty
      const result = validationResult(req);
      expect(result.isEmpty()).toBe(false);
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Product SKU is required' })
        ])
      );
    });
  });
});

describe('Product Validation Integration', () => {
  const postTester = createValidationTester(createProductRules, 'post');
  const putTester = createValidationTester(updateProductRules, 'put');

  it('should return 400 for description exceeding 1000 characters', async () => {
    const longDesc = 'a'.repeat(1001);
    const response = await postTester.send({ ...VALID_PRODUCT, description: longDesc });

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ msg: 'Description cannot exceed 1000 characters' })
      ])
    );
  });

  it('should return 400 if customizationSchema is not an object', async () => {
    const response = await postTester.send({ ...VALID_PRODUCT, customizationSchema: "not-an-object" });

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ msg: 'Customization schema must be a valid JSON object' })
      ])
    );
  });

  it('should return 200 for valid update', async () => {
    const response = await putTester.send({
      name: 'Updated Name',
      price: 19.99
    });

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.message).toBe('Success');
  });

  it('should return 200 for valid creation', async () => {
    const response = await postTester.send(VALID_PRODUCT);
    expect(response.status).toBe(StatusCodes.OK);
  });
});

describe('Product Import Validation', () => {
  const tester = createValidationTester(importProductRules, 'post');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fail if no file is uploaded', async () => {
    // Simulate no file in the request
    const response = await tester.send({});

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.errors[0].msg).toBe('CSV file is required');
  });

  it('should fail if the file is not a CSV', async () => {
    const mockFile = {
      path: '/tmp/test.txt',
      originalname: 'test.txt'
    };

    // Force existsSync to return true so the 'unlink' logic is triggered
    vi.mocked(fs.existsSync).mockReturnValue(true);

    // We must manually pass the file to our tester's request mock
    const response = await tester.sendWithFile({}, mockFile);

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.errors[0].msg).toBe('Uploaded file must be a CSV');
    expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/test.txt');
  });

  it('should fail and cleanup if the file reading encounters an error', async () => {
    const mockFile = { path: '/tmp/corrupt.csv', originalname: 'corrupt.csv' };
    const mockStream = new Readable({ read() {} });
    mockStream.destroy = vi.fn();

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'createReadStream').mockReturnValue(mockStream as any);

    // Mock readline to throw when trying to get the first line
    vi.spyOn(readline, 'createInterface').mockReturnValue({
      [Symbol.asyncIterator]: () => ({
        next: vi.fn().mockRejectedValue(new Error('Read Failure'))
      }),
      close: vi.fn()
    } as any);

    const response = await tester.sendWithFile({}, mockFile);

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ msg: 'Failed to parse CSV headers' })
      ])
    );
    expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/corrupt.csv');
  });

  it('should fail and cleanup if the CSV file is empty', async () => {
    const mockFile = { path: '/tmp/empty.csv', originalname: 'empty.csv' };

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'createReadStream').mockReturnValue({ destroy: vi.fn() } as any);

    // Mock readline to simulate an empty file (done: true)
    vi.spyOn(readline, 'createInterface').mockReturnValue({
      [Symbol.asyncIterator]: () => ({
        // Simulate that the iterator is finished on the first call
        next: vi.fn().mockResolvedValue({ done: true, value: undefined })
      }),
      close: vi.fn()
    } as any);

    const response = await tester.sendWithFile({}, mockFile);

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ msg: 'CSV file is empty' })
      ])
    );
    expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/empty.csv');
  });

  it('should fail if CSV is missing required headers', async () => {
    const mockFile = { path: '/tmp/test.csv', originalname: 'test.csv' };

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'createReadStream').mockReturnValue({ destroy: vi.fn() } as any);

    // Mock readline to return a line with INCORRECT headers
    vi.spyOn(readline, 'createInterface').mockReturnValue({
      [Symbol.asyncIterator]: () => ({
        next: vi.fn().mockResolvedValue({
          done: false,
          value: 'WrongHeader1,WrongHeader2' // This is the "first line"
        })
      }),
      close: vi.fn()
    } as any);

    const response = await tester.sendWithFile({}, mockFile);

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);

    // Verify the specific error message for missing columns
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          msg: expect.stringContaining('Missing required CSV columns')
        })
      ])
    );

    expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/test.csv');
  });

  it('should pass if CSV headers are valid', async () => {
    const mockFile = { path: '/tmp/test.csv', originalname: 'test.csv' };

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'createReadStream').mockReturnValue({ destroy: vi.fn() } as any);

    // Mock readline to return a line with INCORRECT headers
    vi.spyOn(readline, 'createInterface').mockReturnValue({
      [Symbol.asyncIterator]: () => ({
        next: vi.fn().mockResolvedValue({
          done: false,
          value: CSV_PRODUCT_HEADERS.join(',') // This is the "first line"
        })
      }),
      close: vi.fn()
    } as any);

    const response = await tester.sendWithFile({}, mockFile);

    expect(response.status).toBe(StatusCodes.OK);

    // The Controller should handle cleaning up the file
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});