import { describe, it, expect } from 'vitest';
import { Request } from 'express';
import { parsePagination, buildSort } from './queryHelper.js';

describe('Pagination & Sorting Utilities', () => {

  describe('parsePagination', () => {
    // Helper to create a minimal mock request
    const mockReq = (query: any) => ({ query } as unknown as Request);

    it('should return default values when no query params are provided', () => {
      const req = mockReq({});
      const result = parsePagination(req);

      expect(result).toEqual({
        limit: 10,
        page: 1,
        skip: 0
      });
    });

    it('should parse page and limit correctly', () => {
      const req = mockReq({ page: '2', limit: '20' });
      const result = parsePagination(req);

      expect(result.limit).toBe(20);
      expect(result.page).toBe(2);
      expect(result.skip).toBe(20); // (2-1) * 20
    });

    it('should support "perPage" as an alias for "limit"', () => {
      const req = mockReq({ page: '3', perPage: '50' });
      const result = parsePagination(req);

      expect(result.limit).toBe(50);
      expect(result.skip).toBe(100); // (3-1) * 50
    });

    it('should use custom defaultLimit if provided', () => {
      const req = mockReq({});
      const result = parsePagination(req, 25);
      expect(result.limit).toBe(25);
    });

    it('should fallback to defaults if query params are not numbers', () => {
      const req = mockReq({ page: 'abc', limit: 'xyz' });
      const result = parsePagination(req);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });

  describe('buildSort', () => {
    const allowed = ['name', 'price', 'createdAt'];

    it('should return default sort if no sortBy is provided', () => {
      const result = buildSort(undefined, allowed);
      expect(result).toEqual({ name: 'asc' });
    });

    it('should return ascending sort for a valid field', () => {
      const result = buildSort('price', allowed);
      expect(result).toEqual({ price: 'asc' });
    });

    it('should return descending sort for a field starting with "-"', () => {
      const result = buildSort('-createdAt', allowed);
      expect(result).toEqual({ createdAt: 'desc' });
    });

    it('should ignore fields not in the allowed list and return default', () => {
      const result = buildSort('password', allowed, 'createdAt');
      expect(result).toEqual({ createdAt: 'asc' });
    });

    it('should handle custom default fields', () => {
      const result = buildSort(undefined, allowed, 'price');
      expect(result).toEqual({ price: 'asc' });
    });
  });
});