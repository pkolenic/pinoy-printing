import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import { connectDB, getTenantDb, disconnectDB } from './db';
import { logger } from '../utils/logging';
import { AppError } from '../utils/errors';

// 1. Mock only the connection methods while keeping the rest of Mongoose real
vi.mock('mongoose', async (importActual) => {
  const actual = await importActual<typeof mongoose>();
  return {
    ...actual,
    default: {
      ...actual.default,
      createConnection: vi.fn(),
    },
    // Also mock the top-level named export if used
    createConnection: vi.fn(),
  };
});

vi.mock('../utils/logging/index.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    colors: { SYSTEM_INFO: 'green' },
  },
}));

describe('Database Service (Pooling & Multi-Tenant)', () => {
  const primaryUrl = 'mongodb://primary:27017';
  const primaryDb = 'config_store';
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

  // Helper to create a mock Mongoose Connection
  const createMockConnection = (overrides = {}) => ({
    once: vi.fn(),
    model: vi.fn().mockReturnValue({}),
    useDb: vi.fn().mockReturnValue({}),
    close: vi.fn().mockResolvedValue(undefined),
    readyState: 1,
    ...overrides,
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await disconnectDB(); // Resets internal Maps
    process.env.MONGO_URL = primaryUrl;
    process.env.MONGO_DB = primaryDb;
  });

  describe('connectDB', () => {
    it('should throw AppError if environment variables are missing', async () => {
      delete process.env.MONGO_URL;
      try {
        await connectDB();
      } catch (err: any) {
        expect(err).toBeInstanceOf(AppError);
        expect(err.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      }
    });

    it('should initialize the primary pool and SiteConfiguration model', async () => {
      const mockConn = createMockConnection();
      mockConn.once.mockImplementation((event, cb) => {
        if (event === 'open') {
          setTimeout(cb, 0);
        }
      });
      vi.mocked(mongoose.createConnection).mockReturnValue(mockConn as any);

      await connectDB();

      expect(mongoose.createConnection).toHaveBeenCalledWith(primaryUrl, expect.objectContaining({ maxPoolSize: 100 }));
      expect(mockConn.model).toHaveBeenCalledWith('SiteConfiguration', expect.any(Object));
      expect(logger.info).toHaveBeenCalled();
    });

    it('should log error and exit if the primary connection fails', async () => {
      const mockConn = createMockConnection();
      const testErr = new Error('Auth Fail');
      mockConn.once.mockImplementation((event, cb) => {
        if (event === 'error') {
          setTimeout(() => cb(testErr), 0);
        }
      });
      vi.mocked(mongoose.createConnection).mockReturnValue(mockConn as any);

      await connectDB();

      expect(logger.error).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('getTenantDb', () => {
    const tenantConfig = {
      tenantId: 'tenant-1',
      backend: { database: { name: 't1_db', url: primaryUrl } },
    } as any;

    it('should throw AppError if config is malformed', async () => {
      try {
        await getTenantDb({} as any);
        expect.fail('Should have thrown an AppError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(error.message).toContain('Invalid database configuration for tenant:');
      }
    });

    it('should reuse the primary pool if URLs match', async () => {
      const primaryMock = createMockConnection();
      primaryMock.once.mockImplementation((e, cb) => e === 'open' && cb());
      vi.mocked(mongoose.createConnection).mockReturnValue(primaryMock as any);

      await connectDB(); // Set up the primary pool
      await getTenantDb(tenantConfig);

      // Verify createConnection only called once (for primary)
      expect(mongoose.createConnection).toHaveBeenCalledTimes(1);
      expect(primaryMock.useDb).toHaveBeenCalledWith('t1_db', { useCache: true });
    });

    it('should create a new dedicated pool (size 25) for different cluster URLs', async () => {
      const primaryMock = createMockConnection();
      primaryMock.once.mockImplementation((e, cb) => e === 'open' && cb());

      const dedicatedMock = createMockConnection();
      dedicatedMock.once.mockImplementation((e, cb) => e === 'open' && cb());

      vi.mocked(mongoose.createConnection)
        .mockReturnValueOnce(primaryMock as any)
        .mockReturnValueOnce(dedicatedMock as any);

      await connectDB();

      const dedicatedConfig = {
        tenantId: 'dedicated',
        backend: { database: { name: 'dedicated_db', url: 'mongodb://other_cluster' } },
      } as any;

      await getTenantDb(dedicatedConfig);

      expect(mongoose.createConnection).toHaveBeenCalledWith('mongodb://other_cluster', expect.objectContaining({ maxPoolSize: 25 }));
      expect(dedicatedMock.useDb).toHaveBeenCalledWith('dedicated_db', { useCache: true });
    });

    it('should hit the tenant cache on subsequent calls', async () => {
      const mockConn = createMockConnection();
      mockConn.once.mockImplementation((e, cb) => e === 'open' && cb());
      vi.mocked(mongoose.createConnection).mockReturnValue(mockConn as any);

      await connectDB();
      await getTenantDb(tenantConfig);
      await getTenantDb(tenantConfig);

      expect(mockConn.useDb).toHaveBeenCalledTimes(1); // Only once, then cached
    });

    it('should throw AppError if a dedicated tenant pool fails to open', async () => {
      const primaryMock = createMockConnection();
      primaryMock.once.mockImplementation((e, cb) => e === 'open' && cb());

      const failingMock = createMockConnection();
      failingMock.once.mockImplementation((e, cb) => e === 'error' && cb(new Error('Pool Fail')));

      vi.mocked(mongoose.createConnection)
        .mockReturnValueOnce(primaryMock as any)
        .mockReturnValueOnce(failingMock as any);

      await connectDB();

      const config = { backend: { database: { name: 'f', url: 'diff' } } } as any;
      try {
        await getTenantDb(config);
        expect.fail('Should have thrown an AppError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(error.message).toContain('Failed to connect to tenant cluster');
      }
    });
  });

  describe('disconnectDB', () => {
    // Define a helper to automatically trigger 'open' when called
    const setupAutoOpen = (mock: any) => {
      mock.once.mockImplementation((event: string, cb: Function) => {
        if (event === 'open') {
          // Use setImmediate to ensure the promise logic in the source code runs
          setImmediate(cb as any);
        }
      });
    };

    it('should close all active pools in parallel', async () => {
      const mock1 = createMockConnection({ readyState: 1 });
      const mock2 = createMockConnection({ readyState: 1 });
      setupAutoOpen(mock1);
      setupAutoOpen(mock2);

      vi.mocked(mongoose.createConnection)
        .mockReturnValueOnce(mock1 as any)
        .mockReturnValueOnce(mock2 as any);

      // 2. These will no longer timeout because the mock handles the event automatically
      await connectDB();
      await getTenantDb({
        tenantId: 't2',
        backend: { database: { name: 'd', url: 'url2' } }
      } as any);

      // 3. Trigger disconnect
      await disconnectDB();

      // 4. Assertions
      expect(mock1.close).toHaveBeenCalled();
      expect(mock2.close).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('disconnected gracefully') })
      );
    });

    it('should handle and log disconnection errors', async () => {
      const mock1 = createMockConnection({ readyState: 1 });
      setupAutoOpen(mock1);

      // Simulate a failure during the .close() call
      const mockError = new Error('Zombies!');
      mock1.close.mockRejectedValueOnce(mockError);

      vi.mocked(mongoose.createConnection).mockReturnValue(mock1 as any);

      // This won't time out because setupAutoOpen handles the 'open' event
      await connectDB();
      await disconnectDB();

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('global disconnect'),
          args: [mockError]
        })
      );
    });

    it('should skip pools that are already closed', async () => {
      // 2. Set readyState to 0 (Disconnected)
      const mock1 = createMockConnection({ readyState: 0 });
      setupAutoOpen(mock1);

      vi.mocked(mongoose.createConnection).mockReturnValue(mock1 as any);

      await connectDB();
      await disconnectDB();

      // Verify close was never called because readyState was 0
      expect(mock1.close).not.toHaveBeenCalled();
    });
  });
});
