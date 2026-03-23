import { vi } from 'vitest';

// 1. Export the instance so tests can mock values: vi.mocked(mockRedisInstance.getJSON)
export const mockRedisInstance = {
  get: vi.fn(),
  set: vi.fn(),
  getJSON: vi.fn(),
  setJSON: vi.fn(),
  del: vi.fn(),
};

// 2. Define the Mock Class
export class MockRedis {
  static getInstance = vi.fn().mockResolvedValue(mockRedisInstance);
  static connect = vi.fn().mockResolvedValue(mockRedisInstance);
  static disconnect = vi.fn().mockResolvedValue(undefined);

  get = mockRedisInstance.get;
  set = mockRedisInstance.set;
  getJSON = mockRedisInstance.getJSON;
  setJSON = mockRedisInstance.setJSON;
  del = mockRedisInstance.del;
}

// 3. A factory for vi.mock
export const redisMockFactory = () => ({
  default: MockRedis
});
