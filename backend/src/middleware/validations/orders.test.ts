import { describe, it, expect } from 'vitest';
import { validationResult } from 'express-validator';
import { validate, createValidationTester } from "../../test/validations.utils";
import { StatusCodes } from "http-status-codes";
import {
  createOrderRules,
  updateOrderRules,
} from './orders.js';

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

    it('should fail if address is present but missing required fields', async () => {
      const req = await validate(createOrderRules, {
        items: [{ product: VALID_MONGO_ID, quantity: 1 }],
        address: { street: '123 Main St' } // Missing city, region, postalCode
      });

      const result = validationResult(req);
      expect(result.isEmpty()).toBe(false);
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'City is required' }),
          expect.objectContaining({ msg: 'Region is required' }),
          expect.objectContaining({ msg: 'Postal code is required' })
        ])
      );
    });

    it('should fail if address contains _isPrimaryInput', async () => {
      const req = await validate(createOrderRules, {
        items: [{ product: VALID_MONGO_ID, quantity: 1 }],
        address: {
          street: '1',
          city: 'C',
          region: 'R',
          postalCode: '1',
          _isPrimaryInput: true
        }
      });

      const result = validationResult(req);
      expect(result.isEmpty()).toBe(false);
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Orders do not support multiple addresses' })
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

  describe('updateOrderRules', () => {
    it('should pass for a valid partial update (address only)', async () => {
      const req = await validate(updateOrderRules, {
        address: { street: 'New St', city: 'New City', region: 'NA', postalCode: '12345' }
      });
      const result = validationResult(req);
      expect(result.isEmpty()).toBe(true);
    });

    it('should fail if items.*.price is provided', async () => {
      const req = await validate(updateOrderRules, {
        items: [{ product: VALID_MONGO_ID, quantity: 2, price: 10.00 }]
      });

      const result = validationResult(req);
      expect(result.isEmpty()).toBe(false);
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Item prices are calculated by the system and cannot be modified directly' })
        ])
      );
    });

    it('should fail if restricted fields are provided', async () => {
      const req = await validate(updateOrderRules, {
        status: 'shipped',
        paid: new Date(),
        userId: VALID_MONGO_ID
      });

      const result = validationResult(req);
      expect(result.isEmpty()).toBe(false);

      const messages = result.array().map(e => e.msg);
      expect(messages).toContain('Use dedicated routes to update status, payment, or shipping info');
      expect(messages).toContain('The order owner cannot be changed');
    });

    it('should still validate item structure if items are provided', async () => {
      const req = await validate(updateOrderRules, {
        items: [{ product: 'not-a-mongo-id', quantity: 0 }]
      });

      const result = validationResult(req);
      expect(result.isEmpty()).toBe(false);
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Each item must have a valid Product ID' }),
          expect.objectContaining({ msg: 'Each item must have a quantity greater or equal to 1' })
        ])
      );
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

    it('should return 400 if address is present but missing required fields', async () => {
      const response = await tester.send({
        items: [{ product: VALID_MONGO_ID, quantity: 1 }],
        address: { street: '123 Main St' } // Missing city, region, postalCode
      });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'City is required' }),
          expect.objectContaining({ msg: 'Region is required' }),
          expect.objectContaining({ msg: 'Postal code is required' })
        ])
      );
    });

    it('should return 400 if address contains _isPrimaryInput', async () => {
      const response = await tester.send({
        items: [{ product: VALID_MONGO_ID, quantity: 1 }],
        address: {
          street: '1', city: 'C', region: 'R', postalCode: '1',
          _isPrimaryInput: true
        }
      });
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Orders do not support multiple addresses' })
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

  describe('updateOrderRules', () => {
    const tester = createValidationTester(updateOrderRules, 'put');

    it('should return 200 for a valid partial update (address only)', async () => {
      const response = await tester.send({
        address: { street: 'New St', city: 'New City', region: 'NA', postalCode: '12345' }
      });
      expect(response.status).toBe(StatusCodes.OK);
    });

    it('should return 400 if items.*.price is provided', async () => {
      const response = await tester.send({
        items: [{ product: VALID_MONGO_ID, quantity: 2, price: 10.00 }]
      });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Item prices are calculated by the system and cannot be modified directly' })
        ])
      );
    });

    it('should return 400 if restricted fields are provided', async () => {
      const response = await tester.send({
        status: 'shipped',
        paid: new Date(),
        userId: VALID_MONGO_ID
      });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      const messages = response.body.errors.map((e: any) => e.msg);
      expect(messages).toContain('Use dedicated routes to update status, payment, or shipping info');
      expect(messages).toContain('The order owner cannot be changed');
    });

    it('should still validate item structure if items are provided', async () => {
      const response = await tester.send({
        items: [{ product: 'not-a-mongo-id', quantity: 0 }]
      });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Each item must have a valid Product ID' }),
          expect.objectContaining({ msg: 'Each item must have a quantity greater or equal to 1' })
        ])
      );
    });
  });
});
