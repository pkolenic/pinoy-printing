import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger as systemLogger } from './utils/logging/index.js';

// 1. SHARED MOCK INSTANCE: This ensures the test and the server use the SAME object
const mockAppInstance = {
  set: vi.fn(),
  use: vi.fn(),
  listen: vi.fn().mockImplementation((_port, _host, cb) => {
    if (typeof cb === 'function') {
      cb();
    }
    return {
      // Return a spy for the server object
      close: vi.fn((closeCb) => closeCb?.()),
      keepAliveTimeout: 0,
      headersTimeout: 0
    };
  }),
};

// 2. MOCK EXTERNAL SERVICES
vi.mock('./services/db.js', () => ({
  connectDB: vi.fn().mockResolvedValue(true),
  disconnectDB: vi.fn().mockResolvedValue(true),
}));

vi.mock('./services/redis.js', () => ({
  default: {
    connect: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn().mockResolvedValue(true),
  }
}));

vi.mock('./services/auth0.js', () => ({
  clearAuth0Cache: vi.fn().mockResolvedValue(true),
}));

vi.mock('./services/tenantRedis.js', () => ({
  closeAllRedis: vi.fn().mockResolvedValue(true),
}));

vi.mock('./utils/logging/index.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    colors: {
      SUCCESS: 'green',
      SYSTEM_STATE_CHANGE: 'blue',
      SYSTEM_INFO: 'gray',
      ERROR: 'red'
    }
  }
}));

// 3. MOCK EXPRESS: Return the shared instance
vi.mock('express', async (importOriginal) => {
  const actual = await importOriginal<typeof import('express')>();
  return {
    ...actual,
    default: Object.assign(() => mockAppInstance, actual)
  };
});

describe('Server', () => {
  const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    vi.clearAllMocks();
    // Use spyOn to keep process.on and process.listeners intact
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
    // Clean up listeners so they don't leak between tests
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
  });

  describe('Server Entry Point', () => {
    it('should initialize services and start the express server', async () => {
      const { connectDB } = await import('./services/db.js');
      const Redis = (await import('./services/redis.js')).default;

      await import('./server.js');
      await flushPromises(); // Wait for the listen callback to fire

      expect(connectDB).toHaveBeenCalled();
      expect(Redis.connect).toHaveBeenCalled();
      expect(systemLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Server is running') })
      );
    });

    it('should exit process if initialization fails', async () => {
      const { connectDB } = await import('./services/db.js');
      vi.mocked(connectDB).mockRejectedValueOnce(new Error('DB Fail'));

      await import('./server.js');

      expect(systemLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Initialization failed' })
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should set HOST to 127.0.0.1 in development mode', async () => {
      vi.stubEnv('NODE_ENV', 'development');

      await import('./server.js');

      // Check the shared mock instance
      const listenArgs = mockAppInstance.listen.mock.calls[0];
      expect(listenArgs[1]).toBe('127.0.0.1');
    });
  });

  describe('Graceful Shutdown', () => {
    it('should perform cleanup on SIGTERM', async () => {
      await import('./server.js');
      const Redis = (await import('./services/redis.js')).default;
      const { disconnectDB } = await import('./services/db.js');

      const listeners = process.listeners('SIGTERM');
      const sigtermListener = listeners[listeners.length - 1] as Function;

      await sigtermListener('SIGTERM');
      await flushPromises(); // Wait for server.close callback and Promise.all cleanup

      expect(systemLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('SIGTERM received. Gracefully shutting down')
        })
      );

      expect(Redis.disconnect).toHaveBeenCalled();
      expect(disconnectDB).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should force exit if graceful shutdown takes too long', async () => {
      vi.useFakeTimers();
      await import('./server.js');

      const listeners = process.listeners('SIGTERM');
      const sigtermListener = listeners[listeners.length - 1] as Function;

      sigtermListener('SIGTERM');

      // Fast-forward 5 seconds to trigger the fallback setTimeout
      vi.advanceTimersByTime(5000);

      expect(systemLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Force exiting after timeout' })
      );
      expect(process.exit).toHaveBeenCalledWith(1);

      vi.useRealTimers();
    });

    it('should return early if already shutting down', async () => {
      await import('./server.js');
      const listeners = process.listeners('SIGTERM');
      const sigtermListener = listeners[listeners.length - 1] as Function;

      // 1. Clear the mock history from the server startup logs
      vi.mocked(systemLogger.info).mockClear();

      // 2. Trigger first shutdown (sets shuttingDown = true)
      sigtermListener('SIGTERM');

      // 3. Trigger second shutdown (should hit the 'return' on line 76)
      sigtermListener('SIGTERM');

      // 4. Verify the specific "Gracefully shutting down" message only appeared ONCE
      const shutdownLogs = vi.mocked(systemLogger.info).mock.calls.filter(call =>
        call[0].message.includes('Gracefully shutting down')
      );

      expect(shutdownLogs.length).toBe(1);
    });

    it('should log an error if HTTP server fails to close', async () => {
      await import('./server.js'); // Import first to set up listeners

      // 1. Target the server object returned by the LAST listen call
      const serverMock = mockAppInstance.listen.mock.results[0].value;

      // 2. Inject the error into the close callback
      vi.mocked(serverMock.close).mockImplementationOnce((cb: any) => {
        cb(new Error('Close Fail'));
      });

      const listeners = process.listeners('SIGTERM');
      const sigtermListener = listeners[listeners.length - 1] as Function;

      // 3. Trigger shutdown
      await sigtermListener('SIGTERM');

      // 4. Flush the microtask queue to allow the async callback to run
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(systemLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Error during HTTP server close:' })
      );
    });

    it('should log an error if resource cleanup fails', async () => {
      const Redis = (await import('./services/redis.js')).default;
      vi.mocked(Redis.disconnect).mockRejectedValueOnce(new Error('Cleanup Fail'));

      await import('./server.js');
      const listeners = process.listeners('SIGTERM');
      const sigtermListener = listeners[listeners.length - 1] as Function;

      await sigtermListener('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(systemLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Error during resource cleanup:' })
      );
      // Ensure the process still exits 0 via the 'finally' block
      expect(process.exit).toHaveBeenCalledWith(0);
    });
  });
});
