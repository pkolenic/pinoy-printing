import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { Request, Response } from 'express';

import { getSiteConfiguration, configurationMiddleware } from './configuration';
import redis from '../services/redis.js';
import { SiteConfiguration, getTenantDb } from '../services/db.js';
import * as systemUtils from '../utils/system.js';
import { AppError } from '../utils/errors';

// 1. Setup Mocks with explicit Promise returns
vi.mock('../services/redis.js', () => ({
  default: {
    getJSON: vi.fn().mockImplementation(() => Promise.resolve(null)),
    setJSON: vi.fn().mockImplementation(() => Promise.resolve()),
  }
}));

vi.mock('../services/db.js', () => ({
  SiteConfiguration: {
    findOne: vi.fn().mockImplementation(() => Promise.resolve(null)),
  },
  getTenantDb: vi.fn().mockReturnValue({}),
}));

vi.mock('../services/tenantRedis.js', () => ({
  getTenantRedis: vi.fn().mockImplementation(() => Promise.resolve({})),
}));

vi.mock('../utils/system.js', () => ({
  getTenantId: vi.fn().mockReturnValue('test-tenant'),
  getEnv: vi.fn((val, fallback) => val || fallback),
}));

vi.mock('../types/tenantContext.js', () => ({
  getTenantModels: vi.fn().mockReturnValue({}),
}));

describe('Configuration Logic', () => {
  const tenantId = 'test-tenant';

  beforeEach(() => {
    // vi.restoreAllMocks() is key to preventing state leakage between tests
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('getSiteConfiguration', () => {
    it('should return data from Redis on a cache hit', async () => {
      const mockConfig = { frontend: { site: { name: 'Cached Site' } } };
      vi.mocked(redis.getJSON).mockResolvedValue(mockConfig);

      const result = await getSiteConfiguration(tenantId);

      expect(result).toEqual(mockConfig);
      expect(redis.getJSON).toHaveBeenCalledWith(`site-config:${tenantId}`);
      expect(SiteConfiguration.findOne).not.toHaveBeenCalled();
    });

    it('should fetch from DB on cache miss and save to Redis', async () => {
      const dbConfig = { frontend: { site: { name: 'DB Site' } } };
      vi.mocked(redis.getJSON).mockResolvedValue(null);
      vi.mocked(SiteConfiguration.findOne).mockResolvedValue(dbConfig);

      const result = await getSiteConfiguration(tenantId);

      expect(result).toEqual(dbConfig);
      expect(redis.setJSON).toHaveBeenCalledWith(`site-config:${tenantId}`, dbConfig, 600);
    });

    it('should hydrate defaults and save to Redis if DB also misses', async () => {
      vi.mocked(redis.getJSON).mockResolvedValue(null);
      vi.mocked(SiteConfiguration.findOne).mockResolvedValue(null);

      const result = await getSiteConfiguration(tenantId);

      expect(result.frontend.site.name).toBe('Test E-Commerce Site');
      expect(redis.setJSON).toHaveBeenCalledTimes(1);
    });
  });

  describe('configurationMiddleware', () => {
    let req: any;
    let res: any;
    let next: any;

    beforeEach(() => {
      req = { tenantConfig: {} };
      res = {};
      next = vi.fn();
    });

    it('should attach configuration and models to the request', async () => {
      const mockConfig = {
        backend: {
          database: { name: 'tenant-db' },
          redis: { url: 'redis://tenant' }
        }
      };
      vi.mocked(redis.getJSON).mockResolvedValue(mockConfig);

      await configurationMiddleware(req as Request, res as Response, next);

      expect(req.tenantConfig).toEqual(mockConfig);
      expect(getTenantDb).toHaveBeenCalledWith('tenant-db');
      expect(next).toHaveBeenCalledWith();
    });

    it('should fallback to "default" database name if tenantConfig.backend.database.name is missing', async () => {
      // Mock a configuration where the database name is undefined
      const configWithNoDbName = {
        backend: {
          database: {
            // name is missing here
            url: 'mongodb://localhost:27017'
          },
          redis: { url: 'redis://localhost:6379' }
        }
      };

      // 1. Mock getTenantId to succeed
      vi.mocked(systemUtils.getTenantId).mockReturnValue('test-tenant');

      // 2. Mock Redis to return the config with the missing DB name
      vi.mocked(redis.getJSON).mockResolvedValue(configWithNoDbName);

      await configurationMiddleware(req as Request, res as Response, next);

      // 3. Verify getTenantDb was called with the fallback 'default' string
      expect(getTenantDb).toHaveBeenCalledWith('default');
      expect(next).toHaveBeenCalledWith();
    });

    it('should catch AppErrors and pass them directly to next', async () => {
      const specificError = new AppError('Tenant Not Found', StatusCodes.NOT_FOUND);
      vi.mocked(systemUtils.getTenantId).mockImplementation(() => {
        throw specificError;
      });

      await configurationMiddleware(req as Request, res as Response, next);

      // Verify the original error was passed without being wrapped again
      expect(next).toHaveBeenCalledWith(specificError);
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });

    it('should wrap generic errors in a 500 AppError', async () => {
      // 1. Ensure the first line of the middleware succeeds
      vi.mocked(systemUtils.getTenantId).mockReturnValue('test-tenant');

      // 2. Mock the rejection in the second line (getSiteConfiguration -> redis)
      const genericError = new Error('Database Explosion');
      vi.mocked(redis.getJSON).mockRejectedValue(genericError);

      await configurationMiddleware(req as Request, res as Response, next);

      const passedError = next.mock.calls[0][0];

      expect(passedError).toBeInstanceOf(AppError);
      expect(passedError.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR); // 500
      expect(passedError.message).toBe('Database Explosion');
    });

    it('should handle non-error throws by defaulting to "Internal Server Error"', async () => {
      // 1. Ensure the first line of the middleware succeeds
      vi.mocked(systemUtils.getTenantId).mockReturnValue('test-tenant');

      // 2. Mock the rejection
      vi.mocked(redis.getJSON).mockRejectedValue("Something went wrong");

      await configurationMiddleware(req as Request, res as Response, next);

      const passedError = next.mock.calls[0][0];
      expect(passedError.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(passedError.message).toBe('Internal Server Error');
    });
  });
});
