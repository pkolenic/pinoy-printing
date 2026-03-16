import { describe, it, expect } from 'vitest';
import { validationResult } from 'express-validator';
import { validate, createValidationTester } from "../../test/validations.utils";
import { StatusCodes } from "http-status-codes";
import {
  createCategoryRules,
  updateCategoryRules,
} from './categories.js';

const VALID_MONGO_ID = '60d5ec1234567890abcdef12';

describe('Category Validation Rules', () => {
  describe('createCategoryRules', () => {
    it('should fail if name is missing', async () => {
      const req = await validate(createCategoryRules, {});
      const result = validationResult(req);

      expect(result.isEmpty()).toBe(false);
      // Use .find() to be more robust if multiple errors exist
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Category Name is required' })
        ])
      );
    });

    it('should fail if name is empty', async () => {
      const req = await validate(createCategoryRules, { name: '' });
      const result = validationResult(req);

      expect(result.isEmpty()).toBe(false);
      // Use .find() to be more robust if multiple errors exist
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Category Name is required' })
        ])
      );
    });

    it('should return 400 if name is empty', async () => {
      const req = await validate(createCategoryRules, { name: '   ' });
      const result = validationResult(req);

      expect(result.isEmpty()).toBe(false);
      // Use .find() to be more robust if multiple errors exist
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Category Name is required' })
        ])
      );
    });

    it('should fail if name is too short', async () => {
      const req = await validate(createCategoryRules, { name: 'a' });
      const result = validationResult(req);

      expect(result.isEmpty()).toBe(false);
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Category Name must be at least 2 characters long' })
        ])
      );
    });

    it('should fail if parent ID is invalid', async () => {
      const req = await validate(createCategoryRules, {
        name: 'Electronics',
        parent: 'invalid-id'
      });
      const result = validationResult(req);

      expect(result.isEmpty()).toBe(false);
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Parent must be a valid Category ID' })
        ])
      );
    });

    it('should pass if parent is explicitly null', async () => {
      const req = await validate(createCategoryRules, {
        name: 'Electronics',
        parent: null
      });
      const result = validationResult(req);
      expect(result.isEmpty()).toBe(true);
    });

    it('should pass with valid data', async () => {
      const req = await validate(createCategoryRules, {
        name: 'Electronics',
        parent: VALID_MONGO_ID
      });
      const result = validationResult(req);
      expect(result.isEmpty()).toBe(true);
    });
  });

  describe('updateCategoryRules', () => {
    it('should pass if name is missing (optional in update)', async () => {
      const req = await validate(updateCategoryRules, {
        parent: VALID_MONGO_ID
      });
      const result = validationResult(req);
      expect(result.isEmpty()).toBe(true);
    });

    it('should fail if name is too short', async () => {
      const req = await validate(createCategoryRules, {
        name: 'b',
        parent: VALID_MONGO_ID
      });
      const result = validationResult(req);

      expect(result.isEmpty()).toBe(false);
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Category Name must be at least 2 characters long' })
        ])
      );
    });

    it('should still validate parent ID format if provided', async () => {
      const req = await validate(createCategoryRules, {
        parent: 'invalid-id'
      });
      const result = validationResult(req);

      expect(result.isEmpty()).toBe(false);
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Parent must be a valid Category ID' })
        ])
      );
    });
  });
});

describe('Category Validation Integration', () => {
  describe('createCategoryRules', () => {
    const tester = createValidationTester(createCategoryRules, 'post');

    it('should return 400 if name is missing', async () => {
      const response = await tester.send({
        parent: VALID_MONGO_ID
      });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Category Name is required' })
        ])
      );
    });

    it('should return 400 if name is empty', async () => {
      const response = await tester.send({
        name: '',
        parent: VALID_MONGO_ID
      });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Category Name is required' })
        ])
      );
    });

    it('should return 400 if name is empty', async () => {
      const response = await tester.send({
        name: '   ',
        parent: VALID_MONGO_ID
      });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Category Name is required' })
        ])
      );
    });

    it('should return 400 if name is too short', async () => {
      const response = await tester.send({
        name: 'a',
        parent: VALID_MONGO_ID
      });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Category Name must be at least 2 characters long' })
        ])
      );
    });

    it('should return 400 if parent ID is invalid', async () => {
      const response = await tester.send({
        name: 'Electronics',
        parent: 'invalid-id'
      });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Parent must be a valid Category ID' })
        ])
      );
    });

    it('should return 200 if parent is explicitly null', async () => {
      const response = await tester.send({
        name: 'Books',
        parent: null
      });

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body).not.toHaveProperty('errors');
      expect(response.body.message).toBe('Success');
    })

    it('should return 200 if validation passes', async () => {
      const response = await tester.send({
        name: 'Books',
        parent: VALID_MONGO_ID
      });

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body).not.toHaveProperty('errors');
      expect(response.body.message).toBe('Success');
    });
  });

  describe('updateCategoryRules', () => {
    const tester = createValidationTester(updateCategoryRules, 'put');

    it('should pass if name is missing (optional in update)', async () => {
      const response = await tester.send({
        parent: VALID_MONGO_ID
      });

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body).not.toHaveProperty('errors');
      expect(response.body.message).toBe('Success');
    });

    it('should fail if name is too short', async () => {
      const response = await tester.send({
        name: 'b',
        parent: VALID_MONGO_ID
      });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Category Name must be at least 2 characters long' })
        ])
      );
    });

    it('should still validate parent ID format if provided', async () => {
      const response = await tester.send({ parent: 'invalid-id' });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Parent must be a valid Category ID' })
        ])
      );
    });
  });
});
