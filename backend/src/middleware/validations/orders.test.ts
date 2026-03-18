import { describe, it, expect } from 'vitest';
import { validationResult } from 'express-validator';
import { validate, createValidationTester } from "../../test/validations.utils";
import { StatusCodes } from "http-status-codes";
import {
  createOrderRules,
  updateOrderRules,
} from './orders.js';

const VALID_MONGO_ID = '60d5ec1234567890abcdef12';

const createOrderTestCases = {
  failures: [
    ['items is missing', {}, ['Order must contain an array of item objects']],
    ['items is empty', { items: [] }, ['Order must contain at least one item']],
    ['items is not an array', { items: {} }, ['Order must contain an array of item objects']],
    ['items contains non-objects', { items: [{}, 2] }, ['Each item in items must be object']],
    ['item is missing product ID', {
      items: [{
        product: VALID_MONGO_ID,
        quantity: 1
      }, { quantity: 1 }]
    }, ['Each item must have a valid Product ID']],
    ['item product ID is invalid', {
      items: [{
        product: 'invalid-id',
        quantity: 2
      }]
    }, ['Each item must have a valid Product ID']],
    ['item is missing quantity', { items: [{ product: VALID_MONGO_ID }] }, ['Each item must have a quantity']],
    ['item quantity is not a number', {
      items: [{
        product: VALID_MONGO_ID,
        quantity: true
      }]
    }, ['Each item quantity must be a whole number']],
    ['item quantity is a float', {
      items: [{
        product: VALID_MONGO_ID,
        quantity: 1.3
      }]
    }, ['Each item quantity must be a whole number']],
    ['item quantity is less than 1', {
      items: [{
        product: VALID_MONGO_ID,
        quantity: -1
      }]
    }, ['Each item must have a quantity greater or equal to 1']],
    ['customization is not an object', {
      items: [{
        product: VALID_MONGO_ID,
        quantity: 1,
        customization: 'red'
      }]
    }, ["Each item's customization must be an object"]],
    ['address is present but missing required fields', {
      items: [{ product: VALID_MONGO_ID, quantity: 1 }],
      address: { street: '123 Main St' }
    }, ['City is required', 'Region is required', 'Postal code is required']],
    ['address contains _isPrimaryInput', {
      items: [{ product: VALID_MONGO_ID, quantity: 1 }],
      address: { street: '1', city: 'C', region: 'R', postalCode: '1', _isPrimaryInput: true }
    }, ['Orders do not support multiple addresses']],
  ] as const,
  successes: [
    ['valid items and customization', {
      items: [{ product: VALID_MONGO_ID, quantity: 1, customization: { color: 'red' } }]
    }],
    ['valid address and items', {
      items: [{ product: VALID_MONGO_ID, quantity: 1 }],
      address: { street: '1', city: 'C', region: 'R', postalCode: '1' }
    }],
  ] as const,
}

const updateOrderTestCases = {
  failures: [
    ['items.*.price is provided', {
      items: [{
        product: VALID_MONGO_ID,
        quantity: 2,
        price: 10.00
      }]
    }, ['Item prices are calculated by the system and cannot be modified directly']],
    ['restricted fields are provided', {
      status: 'shipped',
      paid: new Date(),
      userId: VALID_MONGO_ID
    }, ['Use dedicated routes to update status, payment, or shipping info', 'The order owner cannot be changed']],
    ['not valid item structure if items are provided', {
      items: [{
        product: 'not-a-mongo-id',
        quantity: 0
      }]
    }, ['Each item must have a valid Product ID', 'Each item must have a quantity greater or equal to 1']],
  ] as const,
  successes: [
    ['valid partial update (address only)', {
      address: {
        street: 'New St',
        city: 'New City',
        region: 'NA',
        postalCode: '12345'
      }
    }],
  ] as const,
};

describe('Order Validation Rules', () => {
  describe('createOrderRules', () => {
    describe('Failure Cases', () => {
      it.each(createOrderTestCases.failures)('should fail if %s', async (_description, payload, expectedMessages) => {
        const req = await validate(createOrderRules, payload);
        const result = validationResult(req);

        expect(result.isEmpty()).toBe(false);
        // Map the expectedMessages into an array of expect.objectContaining objects
        const expectedMatch = expectedMessages.map(msg => expect.objectContaining({ msg }));
        expect(result.array()).toEqual(
          expect.arrayContaining(expectedMatch)
        );
      });
    });

    describe('Success Cases', () => {
      it.each(createOrderTestCases.successes)('should pass with %s', async (_description, payload) => {
        const req = await validate(createOrderRules, payload);
        const result = validationResult(req);
        expect(result.isEmpty()).toBe(true);
      });
    });
  });

  describe('updateOrderRules', () => {
    describe('Failure Cases', () => {
      it.each(updateOrderTestCases.failures)('should fail if %s', async (_description, payload, expectedMessages) => {
        const req = await validate(updateOrderRules, payload);
        const result = validationResult(req);

        expect(result.isEmpty()).toBe(false);

        // Map the expectedMessages into an array of expect.objectContaining objects
        const expectedMatch = expectedMessages.map(msg => expect.objectContaining({ msg }));
        expect(result.array()).toEqual(
          expect.arrayContaining(expectedMatch)
        );
      })
    });

    describe('Success Cases', () => {
      it.each(updateOrderTestCases.successes)('should pass with %s', async (_description, payload) => {
        const req = await validate(updateOrderRules, payload);
        const result = validationResult(req);
        expect(result.isEmpty()).toBe(true);
      });
    });
  });
});

describe('Order Validation Integration', () => {
  describe('createOrderRules', () => {
    const tester = createValidationTester(createOrderRules, 'post');

    describe('Failure Cases', () => {
      it.each(createOrderTestCases.failures)('should fail if %s', async (_description, payload, expectedMessages) => {
        const response = await tester.send(payload);
        expect(response.status).toBe(StatusCodes.BAD_REQUEST);

        // Map the expectedMessages into an array of expect.objectContaining objects
        const expectedMatch = expectedMessages.map(msg => expect.objectContaining({ msg }));
        expect(response.body.errors).toEqual(
          expect.arrayContaining(expectedMatch)
        );
      });
    });

    describe('Success Cases', () => {
      it.each(createOrderTestCases.successes)('should pass with %s', async (_description, payload) => {
        const response = await tester.send(payload);
        expect(response.status).toBe(StatusCodes.OK);
        expect(response.body).not.toHaveProperty('errors');
        expect(response.body.message).toBe('Success');
      });
    });
  });

  describe('updateOrderRules', () => {
    const tester = createValidationTester(updateOrderRules, 'put');

    describe('Failure Cases', () => {
      it.each(updateOrderTestCases.failures)('should fail if %s', async (_description, payload, expectedMessages) => {
        const response = await tester.send(payload);
        expect(response.status).toBe(StatusCodes.BAD_REQUEST);

        // Map the expectedMessages into an array of expect.objectContaining objects
        const expectedMatch = expectedMessages.map(msg => expect.objectContaining({ msg }));
        expect(response.body.errors).toEqual(
          expect.arrayContaining(expectedMatch)
        );
      })
    });

    describe('Success Cases', () => {
      it.each(updateOrderTestCases.successes)('should pass with %s', async (_description, payload) => {
        const response = await tester.send(payload);
        expect(response.status).toBe(StatusCodes.OK);
      });
    });
  });
});
