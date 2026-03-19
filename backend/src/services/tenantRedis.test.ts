import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClient } from 'redis';
import { getTenantRedis, closeAllRedis, TenantRedisWrapper } from './tenantRedis';
import { logger } from '../utils/logging';
import { AppError } from "../utils/errors";
import { StatusCodes } from "http-status-codes";

// 1. Create a stable mock instance for the Redis Client
const redisMock = {
  on: vi.fn(),
  connect: vi.fn().mockResolvedValue(undefined),
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  quit: vi.fn().mockResolvedValue('OK'),
};

// 2. Mock the modules
vi.mock('redis', () => ({
  createClient: vi.fn(() => redisMock),
}));

vi.mock('../utils/logging/index.js', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    colors: { SYSTEM_DEBUG: 'blue' }
  }
}));

describe('TenantRedis Service', () => {
  const mockUrl = 'redis://localhost:6379';
  const tenantId = 'tenant-123';

  beforeEach(async () => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await closeAllRedis(); // Clears the internal connectionPools Map
  });

  describe('getTenantRedis & Connection Pooling', () => {
    it('should create a new connection if URL is new', async () => {
      await getTenantRedis(tenantId, mockUrl);
      expect(createClient).toHaveBeenCalledWith({ url: mockUrl });
      expect(redisMock.connect).toHaveBeenCalled();
    });

    it('should reuse existing connection for the same URL', async () => {
      await getTenantRedis('tenant-1', mockUrl);
      await getTenantRedis('tenant-2', mockUrl);

      // Should only be called once because of the pool
      expect(createClient).toHaveBeenCalledTimes(1);
    });

    it('should fallback to environment variables if URL is missing', async () => {
      const originalEnv = process.env.REDIS_URI;
      process.env.REDIS_URI = 'redis://env-fallback';

      await getTenantRedis(tenantId);
      expect(createClient).toHaveBeenCalledWith({ url: 'redis://env-fallback' });

      process.env.REDIS_URI = originalEnv;
    });

    it('should default to empty string and attempt connection when URL and ENV are missing', async () => {
      // 1. Force environment variables to be undefined
      vi.stubEnv('TENANT_REDIS_URI', '');
      vi.stubEnv('REDIS_URI', '');

      await getTenantRedis(tenantId);

      // 2. Verify createClient was called with an empty string (as per your || '' logic)
      expect(createClient).toHaveBeenCalledWith({ url: '' });

      // 3. Cleanup: Restore environment variables for other tests
      vi.unstubAllEnvs();
    });

    it('should throw AppError if connection fails during initialization', async () => {
      // Force the connect() method to reject
      redisMock.connect.mockRejectedValueOnce(new Error('Connection Refused'));

      try {
        await getTenantRedis(tenantId, mockUrl);
        expect.fail('Should have thrown an AppError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(error.message).toContain('Failed to connect to Redis for tenant');
      }
    });

    it('should log an error when the redis client emits an error', async () => {
      await getTenantRedis(tenantId, mockUrl);

      // Find the 'error' callback registered via client.on('error', (err) => ...)
      // Use ! to tell TS this definitely won't be undefined
      const errorCall = redisMock.on.mock.calls.find(call => call[0] === 'error')!;
      const errorHandler = errorCall[1];

      errorHandler(new Error('Connection Failed'));

      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('Redis Connection Error')
      }));
    });
  });

  describe('TenantRedisWrapper Operations', () => {
    let wrapper: TenantRedisWrapper;

    beforeEach(async () => {
      wrapper = await getTenantRedis(tenantId, mockUrl);
    });

    it('should apply the correct tenant prefix to keys', async () => {
      redisMock.get.mockResolvedValue('some-value');
      await wrapper.get('my-key');
      // Verifies prefixing logic: tenant:tenantId::key
      expect(redisMock.get).toHaveBeenCalledWith(`tenant:${tenantId}::my-key`);
    });

    it('should handle cache misses (null returns) and log debug', async () => {
      redisMock.get.mockResolvedValue(null);
      const result = await wrapper.get('missing-key');

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Tenant Cache miss:'
      }));
    });

    it('should set strings with options', async () => {
      redisMock.set.mockResolvedValue('OK');
      await wrapper.set('foo', 'bar', { expiration: { type: 'EX', value: 10 } });
      expect(redisMock.set).toHaveBeenCalledWith(`tenant:${tenantId}::foo`, 'bar', {
        expiration: {
          type: 'EX',
          value: 10
        }
      });
    });

    it('should handle JSON serialization and deserialization', async () => {
      const complexData = { id: 1, name: 'Test' };
      redisMock.get.mockResolvedValue(JSON.stringify(complexData));

      const getResult = await wrapper.getJSON('data');
      expect(getResult).toEqual(complexData);

      await wrapper.setJSON('data', complexData, 3600);
      expect(redisMock.set).toHaveBeenCalledWith(
        `tenant:${tenantId}::data`,
        JSON.stringify(complexData),
        { expiration: { type: 'EX', value: 3600 } }
      );
    });

    it('should handle deletions for single and multiple keys', async () => {
      // Single key
      await wrapper.del('key1');
      expect(redisMock.del).toHaveBeenCalledWith(`tenant:${tenantId}::key1`);

      // Array of keys
      await wrapper.del(['key1', 'key2']);
      expect(redisMock.del).toHaveBeenCalledWith([
        `tenant:${tenantId}::key1`,
        `tenant:${tenantId}::key2`
      ]);
    });

    it('should expose the native client via the getter', () => {
      expect(wrapper.native).toBe(redisMock);
    });

    it('should cover the "no parse" branch in _read', async () => {
      // Hits the (raw as unknown as T) branch because .get() doesn't pass a parser
      redisMock.get.mockResolvedValue('raw-string');
      const result = await wrapper.get('some-key');

      expect(result).toBe('raw-string');
    });

    it('should cover the "no serialize" branch in _write', async () => {
      // Hits the (value as unknown as string) branch because .set() doesn't pass a serializer
      redisMock.set.mockResolvedValue('OK');
      await wrapper.set('some-key', 'some-value');

      expect(redisMock.set).toHaveBeenCalledWith(
        `tenant:${tenantId}::some-key`,
        'some-value',
        undefined
      );
    });

    it('should cover the "no ttl" branch in setJSON', async () => {
      // Hits the undefined branch of the ttl ternary
      await wrapper.setJSON('json-key', { a: 1 });

      expect(redisMock.set).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify({ a: 1 }),
        undefined
      );
    });
  });

  describe('closeAllRedis', () => {
    it('should quit all active clients and clear the pool', async () => {
      await getTenantRedis('t1', 'redis://1');
      await getTenantRedis('t2', 'redis://2');

      await closeAllRedis();
      expect(redisMock.quit).toHaveBeenCalledTimes(2);


      // Confirming the pool is cleared by checking if a later call recreates the client
      vi.clearAllMocks();
      await getTenantRedis('t1', 'redis://1');
      expect(createClient).toHaveBeenCalledTimes(1);
    });
  });
});
