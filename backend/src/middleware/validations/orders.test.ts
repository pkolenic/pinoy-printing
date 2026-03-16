import { describe, it, expect } from 'vitest';
import { validationResult } from 'express-validator';
import { validate, createValidationTester } from "../../test/validations.utils";
import { StatusCodes } from "http-status-codes";
import { createOrderRules } from './orders.js';

const VALID_MONGO_ID = '60d5ec1234567890abcdef12';
const ANOTHER_VALID_MONGO_ID = '70d5ec1234567890abcdef12';

describe('Order Validation Rules', () => {
  describe('createOrderRules', () => {
    it('should fail if items is missing', async () => {
      const req = await validate(createOrderRules, {});
      const result = validationResult(req);

      expect(result.isEmpty()).toBe(false);
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Order must contain an array of item objects' })
        ])
      );
    });
    it('should fail if items is empty', async () => {
      const req = await validate(createOrderRules, { items: [] });
      const result = validationResult(req);

      expect(result.isEmpty()).toBe(false);
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Order must contain at least one item' })
        ])
      );
    });
    it('should fail if items is not an array', async () => {
      const req = await validate(createOrderRules, { items: {} });
      const result = validationResult(req);

      expect(result.isEmpty()).toBe(false);
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Order must contain an array of item objects' })
        ])
      );
    });
    it('should fail if items is not an array of objects', async () => {
      const req = await validate(createOrderRules, { items: [{}, 2] });
      const result = validationResult(req);

      expect(result.isEmpty()).toBe(false);
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Each item in items must be object' })
        ])
      );
    });

    it('should fail if any item is missing product ID', async () => {
      const req = await validate(createOrderRules, {
        items: [
          { product: VALID_MONGO_ID, quantity: 1 },
          { quantity: 1 },
        ]
      });
      const result = validationResult(req);

      expect(result.isEmpty()).toBe(false);
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Each item must have a valid Product ID' })
        ])
      );
    });
    it('should fail if any item product ID is not a valid Mongo ID', async () => {
      const req = await validate(createOrderRules, {
        items: [
          { product: VALID_MONGO_ID, quantity: 1 },
          { product: 'invalid-id', quantity: 2 },
        ]
      });
      const result = validationResult(req);

      expect(result.isEmpty()).toBe(false);
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Each item must have a valid Product ID' })
        ])
      );
    });

    it('should fail if any item is missing quantity', async () => {
      const req = await validate(createOrderRules, {
        items: [
          { product: VALID_MONGO_ID, quantity: 1 },
          { product: ANOTHER_VALID_MONGO_ID },
        ]
      });
      const result = validationResult(req);

      expect(result.isEmpty()).toBe(false);
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Each item must have a quantity' })
        ])
      );
    });
    it('should fail if any item quantity is not a number', async () => {
      const req = await validate(createOrderRules, {
        items: [
          { product: VALID_MONGO_ID, quantity: 1 },
          { product: ANOTHER_VALID_MONGO_ID, quantity: true },
        ]
      });
      const result = validationResult(req);

      expect(result.isEmpty()).toBe(false);
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Each item quantity must be a whole number' })
        ])
      );
    });
    it('should fail if any item quantity is not an integer', async () => {
      const req = await validate(createOrderRules, {
        items: [
          { product: VALID_MONGO_ID, quantity: 1 },
          { product: ANOTHER_VALID_MONGO_ID, quantity: 1.3 },
        ]
      });
      const result = validationResult(req);

      expect(result.isEmpty()).toBe(false);
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Each item quantity must be a whole number' })
        ])
      );
    })
    it('should fail if any item quantity is less than 1', async () => {
      const req = await validate(createOrderRules, {
        items: [
          { product: VALID_MONGO_ID, quantity: 1 },
          { product: ANOTHER_VALID_MONGO_ID, quantity: -1 },
        ]
      });
      const result = validationResult(req);

      expect(result.isEmpty()).toBe(false);
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Each item must have a quantity greater or equal to 1' })
        ])
      );
    });

    it('should fail if any item customization is not an object', async () => {
      const req = await validate(createOrderRules, {
        items: [
          { product: VALID_MONGO_ID, quantity: 1, customization: { color: 'red' } },
          { product: ANOTHER_VALID_MONGO_ID, quantity: 1, customization: 'red' },
        ]
      });
      const result = validationResult(req);

      expect(result.isEmpty()).toBe(false);
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Each item\'s customization must be an object' })
        ])
      );
    });

    it('should pass with valid data', async () => {
      const req = await validate(createOrderRules, {
        items: [
          { product: VALID_MONGO_ID, quantity: 1, customization: { color: 'red' } },
          { product: ANOTHER_VALID_MONGO_ID, quantity: 1 },
        ]
      });
      const result = validationResult(req);
      expect(result.isEmpty()).toBe(true);
    });
  });
});

describe('Order Validation Integration', () => {
  describe('createOrderRules', () => {
    const tester = createValidationTester(createOrderRules, 'post');

    it('should return 400 if items is missing', async () => {
      const response = await tester.send({});

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Order must contain an array of item objects' })
        ])
      );
    });
    it('should return 400 if items is empty', async () => {
      const response = await tester.send({
        items: [],
      });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Order must contain at least one item' })
        ])
      );
    });
    it('should return 400 if items is not an array', async () => {
      const response = await tester.send({
        items: {},
      });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Order must contain an array of item objects' })
        ])
      );
    });
    it('should return 400 if items is not an array of objects', async () => {
      const response = await tester.send({
        items: [{}, 2]
      });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Each item in items must be object' })
        ])
      );
    });

    it('should return 400 if any item is missing product ID', async () => {
      const response = await tester.send({
        items: [
          { product: VALID_MONGO_ID, quantity: 1 },
          { quantity: 1 }, // Missing product
        ]
      });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Each item must have a valid Product ID' })
        ])
      );
    });
    it('should return 400 if any item product ID is not a valid Mongo ID', async () => {
      const response = await tester.send({
        items: [
          { product: VALID_MONGO_ID, quantity: 1 },
          { product: 'invalid-id', quantity: 2 },
        ]
      });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Each item must have a valid Product ID' })
        ])
      );
    });

    it('should return 400 if any item is missing quantity', async () => {
      const response = await tester.send({
        items: [
          { product: VALID_MONGO_ID, quantity: 1 },
          { product: ANOTHER_VALID_MONGO_ID }, // Missing quantity
        ]
      });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Each item must have a quantity' })
        ])
      );
    });
    it('should return 400 if any item quantity is not a number', async () => {
      const response = await tester.send({
        items: [
          { product: VALID_MONGO_ID, quantity: 1 },
          { product: ANOTHER_VALID_MONGO_ID, quantity: 'five' },
        ]
      });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Each item quantity must be a whole number' })
        ])
      );
    });
    it('should return 400 if any item quantity is a decimal', async () => {
      const response = await tester.send({
        items: [
          { product: VALID_MONGO_ID, quantity: 1 },
          { product: ANOTHER_VALID_MONGO_ID, quantity: 1.3 },
        ]
      });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Each item quantity must be a whole number' })
        ])
      );
    })
    it('should return 400 if any item quantity is less than 1', async () => {
      const response = await tester.send({
        items: [
          { product: VALID_MONGO_ID, quantity: 1 },
          { product: ANOTHER_VALID_MONGO_ID, quantity: -1 },
        ]
      });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Each item must have a quantity greater or equal to 1' })
        ])
      );
    });

    it('should return 400 if any item customization is not an object', async () => {
      const response = await tester.send({
        items: [
          { product: VALID_MONGO_ID, quantity: 1, customization: { color: 'red' } },
          { product: ANOTHER_VALID_MONGO_ID, quantity: 5, customization: 'red' },
        ]
      });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: "Each item's customization must be an object" })
        ])
      );
    });

    it('should return 200 if validation passes', async () => {
      const response = await tester.send({
        items: [
          { product: VALID_MONGO_ID, quantity: 1, customization: { color: 'red' } },
          { product: ANOTHER_VALID_MONGO_ID, quantity: 5 },
        ]
      });

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body).not.toHaveProperty('errors');
      expect(response.body.message).toBe('Success');
    });

  });
});