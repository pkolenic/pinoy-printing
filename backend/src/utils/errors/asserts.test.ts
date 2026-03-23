import { describe, it, expect } from 'vitest';
import { assertExhaustive } from './asserts.js'; // Adjust path accordingly

describe('Exhaustive Check Utility', () => {
  it('should throw an error when an unhandled value is passed', () => {
    const invalidValue = 'UNKNOWN_SEVERITY';

    expect(() => {
      // @ts-expect-error - Intentionally passing an invalid value to test runtime safety
      assertExhaustive(invalidValue);
    }).toThrow(`Unhandled union member: "${invalidValue}"`); // Use .toThrow instead
  });

  it('should include the stringified value in the error message', () => {
    const complexValue = { type: 'unexpected' };

    expect(() => {
      // @ts-expect-error - Testing complex objects passed to exhaustive check
      assertExhaustive(complexValue);
    }).toThrow('Unhandled union member: {"type":"unexpected"}');
  });
});
