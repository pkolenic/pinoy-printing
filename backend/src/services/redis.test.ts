import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from 'redis';
import { logger } from '../utils/logging';
import { AppError } from '../utils/errors';
import { StatusCodes } from 'http-status-codes';

// 1. Hoist the mock client to avoid "ReferenceError: Cannot access before initialization"
const { redisMock } = vi.hoisted(() => ({
  redisMock: {
    on: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue('OK'),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    isOpen: true,
  }
}));

// 2. Setup Mocks
vi.mock('redis', () => ({
  createClient: vi.fn(() => redisMock),
}));

vi.mock('../utils/logging/index.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    colors: { SYSTEM_DEBUG: 'blue' }
  }
}));

// 3. Import Service (Must be after vi.mock)
import Redis from './redis';

describe('Redis Singleton Service', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Manually reset the singleton state between tests to ensure 100% isolation
    (Redis as any).instance = null;
    (Redis as any).initPromise = null;
    redisMock.isOpen = true;
  });

  describe('Static Lifecycle & Singletons', () => {
    it('should implement the singleton pattern (getInstance & connect)', async () => {
      const instance1 = await Redis.getInstance();
      const instance2 = await Redis.connect();

      expect(instance1).toBe(instance2);
      expect(createClient).toHaveBeenCalledTimes(1);
    });

    it('should reuse the existing initPromise if multiple calls are made concurrently', async () => {
      const p1 = Redis.getInstance();
      const p2 = Redis.getInstance();
      await Promise.all([p1, p2]);

      expect(createClient).toHaveBeenCalledTimes(1);
    });

    it('should throw AppError if initial connection fails', async () => {
      const mockError = new Error('Connection Refused');
      redisMock.connect.mockRejectedValueOnce(mockError);

      try {
        await Redis.getInstance();
        expect.fail('Should have thrown an AppError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(error.message).toContain('Failed to establish initial Redis connection');
        expect((Redis as any).initPromise).toBeNull(); // State reset for retry
      }
    });

    it('should re-initialize if the existing instance is closed', async () => {
      await Redis.getInstance();
      redisMock.isOpen = false; // Simulate unexpected closure

      await Redis.getInstance();
      expect(createClient).toHaveBeenCalledTimes(2);
    });
  });

  describe('Reconnection Strategy', () => {
    it('should provide exponential backoff and eventually fail with AppError', async () => {
      await Redis.getInstance();

      // 1. Cast the calls to 'any' to bypass the "possibly undefined" array indexing
      const calls = vi.mocked(createClient).mock.calls as any;

      // 2. Safely grab the strategy. Since calls are 'any', TS won't flag the indices
      const strategy = calls[0][0].socket?.reconnectStrategy;

      // 3. Verify it is a function before calling
      expect(strategy).toBeTypeOf('function');

      // Test exponential backoff: 50 * 2^1 = 100
      expect(strategy(1)).toBe(100);
      // Test cap at 2000
      expect(strategy(10)).toBe(2000);

      // Test failure at 11 attempts
      const result = strategy(11);
      expect(result).toBeInstanceOf(AppError);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('reconnection failed') })
      );
    });
  });

  describe('Disconnect Logic', () => {
    it('should do nothing if disconnect is called when no instance exists', async () => {
      await Redis.disconnect();
      expect(redisMock.quit).not.toHaveBeenCalled();
    });

    it('should gracefully quit the client and reset state', async () => {
      await Redis.getInstance();
      await Redis.disconnect();

      expect(redisMock.quit).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Redis connection closed gracefully.' })
      );
      expect((Redis as any).instance).toBeNull();
    });

    it('should catch and log errors if disconnect is called while a failing connection is in progress', async () => {
      // 1. Force the connection attempt to fail
      const mockError = new Error('Fatal during connect');
      redisMock.connect.mockRejectedValueOnce(mockError);

      // 2. Start the connection (creates the initPromise)
      const initPromise = Redis.getInstance();

      // 3. Call disconnect while initPromise is still pending
      // Triggers the try/catch inside Redis.disconnect()
      await Redis.disconnect();

      // 4. Verify the logger was called with the RE-WRAPPED AppError
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Error during Redis disconnect:',
          args: [expect.any(AppError)] // We expect the re-wrapped AppError here
        })
      );

      // 5. Clean up the rejected promise (it will be the re-wrapped AppError)
      try {
        await initPromise;
        expect.fail('initPromise should have rejected');
      } catch (err: any) {
        expect(err).toBeInstanceOf(AppError);
        expect(err.message).toContain('Failed to establish initial Redis connection');
        expect(err.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      }
    });
  });

  describe('Operations & Self-Healing', () => {
    it('should log errors emitted by the redis client', async () => {
      await Redis.getInstance();
      const errorCall = vi.mocked(redisMock.on).mock.calls.find(args => args[0] === 'error');
      const errorHandler = errorCall![1];

      errorHandler(new Error('Async Failure'));
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Redis Error') })
      );
    });

    it('should handle cache hits and misses with debug logging', async () => {
      const redis = await Redis.getInstance();

      // Test Miss
      redisMock.get.mockResolvedValueOnce(null);
      const miss = await redis.get('key');
      expect(miss).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(expect.objectContaining({ message: 'Cache miss:' }));

      // Test Hit
      redisMock.get.mockResolvedValueOnce('val');
      const hit = await redis.get('key');
      expect(hit).toBe('val');
      expect(logger.debug).toHaveBeenCalledWith(expect.objectContaining({ message: 'Cache hit:' }));
    });

    it('should trigger self-healing if client is closed during an operation', async () => {
      const redis = await Redis.getInstance();
      redisMock.isOpen = false;

      redisMock.get.mockResolvedValueOnce('recovered');
      const result = await redis.get('key');

      expect(result).toBe('recovered');
      expect(createClient).toHaveBeenCalledTimes(2);
    });

    it('should handle JSON methods and TTL branches', async () => {
      const redis = await Redis.getInstance();
      const data = { x: 1 };

      // getJSON
      redisMock.get.mockResolvedValueOnce(JSON.stringify(data));
      const res = await redis.getJSON('j');
      expect(res).toEqual(data);

      // setJSON with TTL
      await redis.setJSON('j', data, 60);
      expect(redisMock.set).toHaveBeenCalledWith('j', JSON.stringify(data), { expiration: { type: 'EX', value: 60 } });

      // setJSON without TTL (hits undefined branch)
      await redis.setJSON('j2', data);
      expect(redisMock.set).toHaveBeenCalledWith('j2', JSON.stringify(data), undefined);
    });

    it('should call set and cover the "no serialize" branch in _write', async () => {
      const redis = await Redis.getInstance();
      redisMock.set.mockResolvedValueOnce('OK');

      // This hits the red line 178 AND the yellow branch on line 151
      await redis.set('text-key', 'plain-string');

      expect(redisMock.set).toHaveBeenCalledWith('text-key', 'plain-string', undefined);
    });

    it('should call getJSON and cover the JSON.parse branch in _read', async () => {
      const redis = await Redis.getInstance();
      const mockData = { id: 123 };
      redisMock.get.mockResolvedValueOnce(JSON.stringify(mockData));

      // This hits the red line 182
      const result = await redis.getJSON('json-key');

      expect(result).toEqual(mockData);
    });

    it('should call get and cover the "no parse" branch in _read', async () => {
      const redis = await Redis.getInstance();
      redisMock.get.mockResolvedValueOnce('raw-value');

      // This ensures line 173 is hit and covers the raw-return ternary branch
      const result = await redis.get('raw-key');

      expect(result).toBe('raw-value');
    });

    it('should handle deletion of single keys and arrays', async () => {
      const redis = await Redis.getInstance();
      await redis.del('a');
      await redis.del(['b', 'c']);
      expect(redisMock.del).toHaveBeenCalledTimes(2);
    });
  });
});
