import { Request } from 'express';
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from 'vitest';
import {
  getEnv,
  getTargetHostname,
  getTenantId,
} from './system.js';

describe('getEnv', () => {
  it('should return the default value if the environment variable value is missing or empty', () => {
    expect(getEnv(undefined, 'default')).toBe('default');
    expect(getEnv('', 'default')).toBe('default');
    expect(getEnv('', 42)).toBe(42);
    expect(getEnv(undefined, false)).toBe(false);
  });

  it('should parse and return a boolean value', () => {
    expect(getEnv('true', false)).toBe(true);
    expect(getEnv('TRUE', false)).toBe(true);
    expect(getEnv('false', true)).toBe(false);
    expect(getEnv('anything_else', true)).toBe(false);
  });

  it('should handle unconventional boolean strings as false', () => {
    // Your regex /^true$/i is strict. Let's confirm "1", "yes", or "on" return false
    expect(getEnv('1', false)).toBe(false);
    expect(getEnv('yes', false)).toBe(false);
  });

  it('should parse and return a number value', () => {
    expect(getEnv('123', 0)).toBe(123);
    expect(getEnv('not-a-number', 42)).toBe(42);
  });

  it('should handle zero and negative numbers correctly', () => {
    expect(getEnv('0', 10)).toBe(0);
    expect(getEnv('-50', 10)).toBe(-50);
  });

  it('should handle scientific notation for numbers if provided', () => {
    expect(getEnv('1e3', 0)).toBe(1000);
  });

  it('should return the string value if the default is a string', () => {
    expect(getEnv('hello', 'default')).toBe('hello');
  });
});

describe('getTargetHostname & getTenantId', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should return the lowercase hostname by default', () => {
    const req = { hostname: 'MySite.Com' } as Request;
    expect(getTargetHostname(req)).toBe('mysite.com');
    expect(getTenantId(req)).toBe('mysite_com');
  });

  it('should only return the hostname', () => {
    const req = { protocol: 'https', hostname: 'MySite.Com', path: 'page/test.html' } as Request;
    expect(getTargetHostname(req)).toBe('mysite.com');
    expect(getTenantId(req)).toBe('mysite_com');
  })

  it('should return the SITE override in development mode', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const req = {
      hostname: 'localhost',
      query: { SITE: 'DevSite.com' }
    } as unknown as Request;

    expect(getTargetHostname(req)).toBe('devsite.com');
    expect(getTenantId(req)).toBe('devsite_com');
  });

  it('should NOT return the SITE override in production mode', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const req = {
      hostname: 'RealSite.com',
      query: { SITE: 'Malicious.com' }
    } as unknown as Request;

    expect(getTargetHostname(req)).toBe('realsite.com');
    expect(getTenantId(req)).toBe('realsite_com');
  });
});