import { describe, it, expect, vi } from 'vitest';
import { Request } from 'express';
import { paginateResponse } from './pagination.js';

describe('Pagination Utility', () => {
  // Helper to create a mock Express Request
  const createMockReq = (url: string): Request => {
    return {
      protocol: 'http',
      get: vi.fn().mockReturnValue('localhost:3000'),
      originalUrl: url,
    } as unknown as Request;
  };

  it('should calculate total pages correctly', () => {
    const req = createMockReq('/api/products?page=1');
    const data = [{ id: 1 }, { id: 2 }];

    const result = paginateResponse(req, data, 10, 1, 2);

    expect(result.totalItems).toBe(10);
    expect(result.totalPages).toBe(5);
    expect(result.data).toEqual(data);
  });

  it('should use default limit of 10 if limit is 0 to avoid division by zero', () => {
    const req = createMockReq('/api/items');
    // totalItems = 50, limit = 0
    const result = paginateResponse(req, [], 50, 1, 0);

    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(5); // 50 / 10
  });

  it('should handle large totalItems with default limit', () => {
    const req = createMockReq('/api/items');
    // @ts-ignore
    const result = paginateResponse(req, [], 1000, 1, undefined);

    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(100);
  });

  it('should generate nextPageUrl when a next page exists', () => {
    const req = createMockReq('/api/products?page=1&limit=2');
    const result = paginateResponse(req, [], 10, 1, 2);

    // Should point to page 2 and keep the limit param
    expect(result.nextPageUrl).toContain('page=2');
    expect(result.nextPageUrl).toContain('limit=2');
    expect(result.prevPageUrl).toBeNull();
  });

  it('should generate prevPageUrl when a previous page exists', () => {
    const req = createMockReq('/api/products?page=3');
    const result = paginateResponse(req, [], 10, 3, 2);

    expect(result.prevPageUrl).toContain('page=2');
    expect(result.nextPageUrl).toContain('page=4');
  });

  it('should use default page 1 if currentPage is undefined', () => {
    const req = createMockReq('/api/items');
    // @ts-ignore - testing runtime behavior for JS/loose types
    const result = paginateResponse(req, [], 50, undefined, 10);

    expect(result.currentPage).toBe(1);
    expect(result.prevPageUrl).toBeNull();
  });

  it('should return null for nextPageUrl on the last page', () => {
    const req = createMockReq('/api/products?page=5');
    const result = paginateResponse(req, [], 10, 5, 2);

    expect(result.nextPageUrl).toBeNull();
    expect(result.prevPageUrl).not.toBeNull();
  });

  it('should preserve existing query parameters in generated URLs', () => {
    const req = createMockReq('/api/products?search=shoes&sort=price&page=1');
    const result = paginateResponse(req, [], 10, 1, 5);

    expect(result.nextPageUrl).toContain('search=shoes');
    expect(result.nextPageUrl).toContain('sort=price');
    expect(result.nextPageUrl).toContain('page=2');
  });

  it('should correctly resolve paths in nested routers using currentUrl.pathname', () => {
    // Simulate a nested router where baseUrl is /api and pathname is /api/v1/products
    const req = {
      protocol: 'http',
      get: vi.fn().mockReturnValue('localhost:3000'),
      originalUrl: '/api/v1/products?page=1',
    } as unknown as Request;

    const result = paginateResponse(req, [], 20, 1, 10);

    // Should include the full path /api/v1/products, not just /api
    expect(result.nextPageUrl).toContain('http://localhost:3000/api/v1/products');
    expect(result.nextPageUrl).toContain('page=2');
  });
});