import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, logger } from './logger';
import colors from 'colors';

// Global setup: Disable colors for consistent string matching in tests
colors.disable();

describe('Logger Class', () => {
  // Shared Spies for all console methods
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
  });
  const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
  });
  const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {
  });
  const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {
  });
  const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
  });

  beforeEach(() => {
    vi.clearAllMocks();
    Logger._resetInstance();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('Core Singleton & Level Logic', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = Logger.getInstance();
      const instance2 = Logger.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should default to "error" level if LOG_LEVEL is not set', () => {
      vi.stubEnv('LOG_LEVEL', '');
      const activeLogger = Logger.getInstance();
      // @ts-ignore - accessing private field for coverage
      expect(activeLogger.logLevel).toBe('error');
    });

    it('should suppress logs below the current LOG_LEVEL', () => {
      vi.stubEnv('LOG_LEVEL', 'error');
      const activeLogger = Logger.getInstance();

      activeLogger.info({ message: 'Should be suppressed' });
      activeLogger.debug({ message: 'Should be suppressed' });

      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });
  });

  describe('Development Mode (Colored Console)', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('LOG_LEVEL', 'debug'); // Allow all levels
    });

    it('should route severities to correct console methods', () => {
      const l = Logger.getInstance();

      l.error({ message: 'Dev Error' });
      l.warn({ message: 'Dev Warn' });
      l.info({ message: 'Dev Info' });
      l.debug({ message: 'Dev Debug' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Dev Error'));
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Dev Warn'));
      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Dev Info'));
      expect(consoleDebugSpy).toHaveBeenCalledWith(expect.stringContaining('Dev Debug'));
    });

    it('should use default severity colors for specific methods', () => {
      expect(logger.colors.ERROR).toBe('red');
      expect(logger.colors.SUCCESS).toBe('green');
    });
  });

  describe('Production Mode (Structured JSON)', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('LOG_LEVEL', 'info');
    });

    it('should log JSON to console.error for errors', () => {
      Logger.getInstance().error({ message: 'Prod Error' });
      expect(consoleErrorSpy).toHaveBeenCalled();
      const json = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(json.level).toBe('error');
    });

    it('should log JSON to console.log for non-error severities', () => {
      Logger.getInstance().info({ message: 'Prod Info' });
      expect(consoleLogSpy).toHaveBeenCalled();
      const json = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(json.level).toBe('info');
    });

    it('should include tenantId (or "system" default) in JSON', () => {
      const l = Logger.getInstance();

      // Test with custom tenantId
      l.info({ message: 'Action', tenantId: 'tenant_123' });
      let json = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(json.tenantId).toBe('tenant_123');

      // Test default fallback
      l.info({ message: 'System Action' });
      json = JSON.parse(consoleLogSpy.mock.calls[1][0]);
      expect(json.tenantId).toBe('system');
    });

    it('should fallback to an empty array for data if args are missing', () => {
      // 1. Call info without providing an 'args' property
      Logger.getInstance().info({ message: 'No Args Log' });

      expect(consoleLogSpy).toHaveBeenCalled();
      const json = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      // 2. Verify that 'data' is an empty array, not undefined or null
      expect(json.data).toEqual([]);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe('Data Formatting & Edge Cases', () => {
    it('should format Error objects and handle missing stacks', () => {
      vi.stubEnv('LOG_LEVEL', 'error');
      const l = Logger.getInstance();

      // 1. With stack trace
      const errWithStack = new Error('Fail');
      errWithStack.stack = 'Error: Fail\n  at line 1';
      l.error({ message: 'Log', args: [errWithStack] });
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('at line 1'));

      // 2. Without stack trace (triggers branch fallback)
      const errNoStack = new Error('No stack');
      delete errNoStack.stack;
      l.error({ message: 'test', args: [errNoStack] });
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('No stack'));
    });

    it('should handle mixed argument types (pretty-print objects)', () => {
      vi.stubEnv('LOG_LEVEL', 'debug');
      Logger.getInstance().debug({
        message: 'Mixed',
        args: ['Primitive', { obj: true }, 123]
      });

      const output = consoleDebugSpy.mock.calls[0][0];
      expect(output).toContain('Primitive');
      expect(output).toContain('"obj": true');
      expect(output).toContain('123');
    });
  });
});