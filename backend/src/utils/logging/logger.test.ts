import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, logger } from './logger';
import colors from 'colors';

// Turns off all ANSI styling for the duration of the test
colors.disable();

describe('Logger Class', () => {
  // Spy on all relevant console methods
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
  });
  const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
  });
  const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {
  });
  const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the singleton instance so each test can stub a fresh LOG_LEVEL
    Logger._resetInstance();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should log an error to console.error when LOG_LEVEL is "error"', () => {
    vi.stubEnv('LOG_LEVEL', 'error');
    const activeLogger = Logger.getInstance();

    activeLogger.error({ message: 'Test Error Message' });

    expect(consoleErrorSpy).toHaveBeenCalled();
    const lastCall = consoleErrorSpy.mock.calls[0][0];
    expect(lastCall).toContain('Test Error Message');
  });

  it('should format Error objects in args correctly (stack traces)', () => {
    vi.stubEnv('LOG_LEVEL', 'error');
    const activeLogger = Logger.getInstance();

    const mockError = new Error('Database Connection Failed');
    mockError.stack = 'Error: Database Connection Failed\n    at Object.test (test.ts:10:5)';

    activeLogger.error({
      message: 'Critical Failure',
      args: [mockError]
    });

    // Main message is logged first
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Critical Failure'));
    // Each line of the stack trace should be logged as a separate call in your implementation
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error: Database Connection Failed'));
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('at Object.test'));
  });

  it('should pretty-print object arguments', () => {
    vi.stubEnv('LOG_LEVEL', 'debug');
    const activeLogger = Logger.getInstance();
    const payload = { userId: 42, action: 'login' };

    activeLogger.debug({ message: 'User Event', args: [payload] });

    expect(consoleDebugSpy).toHaveBeenCalled();

    // Get the first argument of the first call
    const output = consoleDebugSpy.mock.calls[0][0];

    // Now you can check the clean string directly
    expect(output).toContain('"userId": 42');
    expect(output).toContain('"action": "login"');
  });

  it('should respect LOG_LEVEL and suppress lower severity logs', () => {
    // Set level to error: info and debug should be ignored
    vi.stubEnv('LOG_LEVEL', 'error');
    const activeLogger = Logger.getInstance();

    activeLogger.info({ message: 'This should not appear' });
    activeLogger.debug({ message: 'This should also not appear' });

    expect(consoleInfoSpy).not.toHaveBeenCalled();
    expect(consoleDebugSpy).not.toHaveBeenCalled();
  });

  it('should log info messages when LOG_LEVEL is "info"', () => {
    vi.stubEnv('LOG_LEVEL', 'info');
    const activeLogger = Logger.getInstance();

    activeLogger.info({ message: 'General Information' });

    expect(consoleInfoSpy).toHaveBeenCalled();
    expect(consoleInfoSpy.mock.calls[0][0]).toContain('General Information');
  });

  it('should log a warning to console.warn when LOG_LEVEL is "warn"', () => {
    vi.stubEnv('LOG_LEVEL', 'warn');
    const activeLogger = Logger.getInstance();

    activeLogger.warn({ message: 'Potential Issue Detected' });

    expect(consoleWarnSpy).toHaveBeenCalled();
    const lastCall = consoleWarnSpy.mock.calls[0][0];
    expect(lastCall).toContain('Potential Issue Detected');
  });

  it('should use default severity colors for specific methods', () => {
    // We check the constants directly to ensure mapping hasn't changed
    expect(logger.colors.ERROR).toBe('red');
    expect(logger.colors.SUCCESS).toBe('green');
    expect(logger.colors.SYSTEM_DEBUG).toBe('cyan');
  });

  it('should handle multiple arguments of mixed types', () => {
    vi.stubEnv('LOG_LEVEL', 'debug');
    const activeLogger = Logger.getInstance();

    activeLogger.debug({
      message: 'Mixed Args',
      args: ['Plain String', { key: 'val' }, 123]
    });

    expect(consoleDebugSpy).toHaveBeenCalled();
    const output = consoleDebugSpy.mock.calls[0][0];
    expect(output).toContain('Plain String');
    expect(output).toContain('"key": "val"');
    expect(output).toContain('123');
  });

  it('should log structured JSON when NODE_ENV is production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LOG_LEVEL', 'info');
    Logger._resetInstance();
    const activeLogger = Logger.getInstance();

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {
    });

    activeLogger.info({ message: 'Production log', args: [{ id: 1 }] });

    expect(logSpy).toHaveBeenCalled();
    const json = JSON.parse(logSpy.mock.calls[0][0]);
    expect(json.message).toBe('Production log');
    expect(json.level).toBe('info');
    expect(json.data).toContainEqual({ id: 1 });
  });

  it('should include tenantId in JSON when req is provided', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LOG_LEVEL', 'info');
    Logger._resetInstance();
    const activeLogger = Logger.getInstance();

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {
    });

    activeLogger.info({
      message: 'Tenant Action',
      tenantId: 'tenant_123',
      args: [{ id: 1 }]
    });

    expect(logSpy).toHaveBeenCalled();

    const json = JSON.parse(logSpy.mock.calls[0][0]);

    expect(json.tenantId).toBe('tenant_123');
    expect(json.message).toBe('Tenant Action');
    expect(json.data).toContainEqual({ id: 1 });
  });
});
