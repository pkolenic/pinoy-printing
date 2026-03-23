import { describe, it, expect } from 'vitest';
import { validationResult } from 'express-validator';
import { StatusCodes } from "http-status-codes";
import { validate, createValidationTester } from "../../test/validations.utils.js";
import { createUserRules, updateUserRules, updatePasswordRules } from './users.js';

const VALID_EMAIL = 'test@example.com';
const VALID_PHONE = '+12025550123';
const STRONG_PASSWORD = 'Password123!';

describe('User Validation Rules', () => {
  describe('createUserRules', () => {
    it('should fail if email is missing', async () => {
      const req = await validate(createUserRules, { password: STRONG_PASSWORD });
      const result = validationResult(req);

      expect(result.isEmpty()).toBe(false);
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Email is required' })
        ])
      );
    });

    it('should fail if email is invalid', async () => {
      const req = await validate(createUserRules, {
        email: 'not-an-email',
        password: STRONG_PASSWORD
      });
      const result = validationResult(req);

      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Please provide a valid email address' })
        ])
      );
    });

    it('should fail if password is too short', async () => {
      const req = await validate(createUserRules, {
        email: VALID_EMAIL,
        password: '123'
      });
      const result = validationResult(req);

      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Password must be at least 8 characters long' })
        ])
      );
    });

    it('should fail if password is weak (missing symbols/numbers)', async () => {
      const req = await validate(createUserRules, {
        email: VALID_EMAIL,
        password: 'onlylowercase'
      });
      const result = validationResult(req);

      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Password must include uppercase, lowercase, numbers, and symbols' })
        ])
      );
    });

    it('should fail if phone is provided but in wrong format', async () => {
      const req = await validate(createUserRules, {
        email: VALID_EMAIL,
        password: STRONG_PASSWORD,
        phone: '12345' // Missing '+' and too short
      });
      const result = validationResult(req);

      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Invalid phone format, use the E.164 format ^+[0-9]{1,15}$' })
        ])
      );
    });

    it('should pass with valid data', async () => {
      const req = await validate(createUserRules, {
        email: VALID_EMAIL,
        password: STRONG_PASSWORD,
        phone: VALID_PHONE
      });
      const result = validationResult(req);
      expect(result.isEmpty()).toBe(true);
    });
  });

  describe('updateUserRules', () => {
    it('should allow missing email (optional for update)', async () => {
      const req = await validate(updateUserRules, { phone: VALID_PHONE });
      const result = validationResult(req);
      expect(result.isEmpty()).toBe(true);
    });

    it('should allow missing phone (optional for update)', async () => {
      const req = await validate(updateUserRules, { email: VALID_EMAIL });
      const result = validationResult(req);
      expect(result.isEmpty()).toBe(true);
    });

    it('should still validate email if it is provided', async () => {
      const req = await validate(updateUserRules, { email: 'bad-email' });
      const result = validationResult(req);
      expect(result.isEmpty()).toBe(false);
      expect(result.array()[0].msg).toBe('Please provide a valid email address');
    });

    it('should still validate phone if it is provided', async () => {
      const req = await validate(updateUserRules, { phone: '12345' });
      const result = validationResult(req);
      expect(result.isEmpty()).toBe(false);
      expect(result.array()[0].msg).toBe('Invalid phone format, use the E.164 format ^+[0-9]{1,15}$');
    });
  });

  describe('updatePasswordRules', () => {
    it('should enforce strong password rules on update', async () => {
      const req = await validate(updatePasswordRules, { password: 'short' });
      const result = validationResult(req);

      expect(result.isEmpty()).toBe(false);
      expect(result.array()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Password must be at least 8 characters long' })
        ])
      );
    });

    it('should pass with a strong new password', async () => {
      const req = await validate(updatePasswordRules, { password: 'NewStrongPassword123!' });
      const result = validationResult(req);
      expect(result.isEmpty()).toBe(true);
    });
  });
});

describe('User Validation Integration', () => {
  describe('createUserRules', () => {
    const tester = createValidationTester(createUserRules, 'post');

    it('should fail if email is missing', async () => {
      const res = await tester.send({ password: STRONG_PASSWORD });
      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
      expect(res.body.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ msg: 'Email is required' })
      ]));
    });

    it('should fail if email is invalid', async () => {
      const res = await tester.send({ email: 'not-an-email', password: STRONG_PASSWORD });
      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
      expect(res.body.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ msg: 'Please provide a valid email address' })
      ]));
    });

    it('should fail if password is too short', async () => {
      const res = await tester.send({ email: VALID_EMAIL, password: '123' });
      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
      expect(res.body.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ msg: 'Password must be at least 8 characters long' })
      ]));
    });

    it('should fail if password is weak (missing symbols/numbers)', async () => {
      const res = await tester.send({ email: VALID_EMAIL, password: 'onlylowercase' });
      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
      expect(res.body.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ msg: 'Password must include uppercase, lowercase, numbers, and symbols' })
      ]));
    });

    it('should fail if phone format is wrong (strict E.164)', async () => {
      const res = await tester.send({
        email: VALID_EMAIL,
        password: STRONG_PASSWORD,
        phone: '12345' // Missing '+'
      });
      expect(res.body.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ msg: 'Invalid phone format, use the E.164 format ^+[0-9]{1,15}$' })
      ]));
    });

    it('should pass with valid data', async () => {
      const res = await tester.send({
        email: VALID_EMAIL, // Will be normalized
        password: STRONG_PASSWORD,
        phone: VALID_PHONE
      });
      expect(res.status).toBe(StatusCodes.OK);
    });
  });

  describe('updateUserRules', () => {
    const tester = createValidationTester(updateUserRules, 'put');

    it('should allow missing email (optional for update)', async () => {
      const res = await tester.send({ phone: VALID_PHONE });
      expect(res.status).toBe(StatusCodes.OK);
    });

    it('should allow missing phone (optional for update)', async () => {
      const res = await tester.send({ email: VALID_EMAIL });
      expect(res.status).toBe(StatusCodes.OK);
    });

    it('should still validate email if it is provided', async () => {
      const res = await tester.send({ email: 'bad-email' });
      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
      expect(res.body.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ msg: 'Please provide a valid email address' })
      ]));
    });

    it('should still validate phone if it is provided', async () => {
      const res = await tester.send({ phone: '12345' });
      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
      expect(res.body.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ msg: expect.stringContaining('Invalid phone format, use the E.164 format ^+[0-9]{1,15}$') })
      ]));
    });
  });

  describe('updatePasswordRules', () => {
    const tester = createValidationTester(updatePasswordRules, 'put');

    it('should enforce strong password on update', async () => {
      const res = await tester.send({ password: 'onlylowercase' });
      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
      expect(res.body.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ msg: expect.stringContaining('Password must include uppercase, lowercase, numbers, and symbols') })
      ]));
    });

    it('should pass with a strong new password', async () => {
      const res = await tester.send({ password: 'NewStrongPassword123!' });
      expect(res.status).toBe(StatusCodes.OK);
    });
  });
});