import { createClient, SetOptions } from "redis";
import { logger } from '../utils/logging/index.js';

// Derived type for the Redis client
export type RedisClient = ReturnType<typeof createClient>;

// Connection Pool: Maps "URL" -> "Connected Redis Client"
const connectionPools = new Map<string, RedisClient>();

export class TenantRedisWrapper {
  private client: RedisClient;
  private prefix: string;

  constructor(client: RedisClient, tenantId: string) {
    this.client = client;
    this.prefix = `tenant:${tenantId}`; // Standard hierarchical namespace
  }

  private applyPrefix(key: string): string {
    return `${this.prefix}::${key}`;
  }

  // Scoped helper methods

  // Support for single or multiple key deletion
  async del(key: string | string[]) {
    const keys = Array.isArray(key) ? key.map(k => this.applyPrefix(k)) : this.applyPrefix(key);
    return this.client.del(keys);
  }

  async get(key: string) {
    return this.client.get(this.applyPrefix(key));
  }

  // Fixed Typing: Use SetOptions from 'redis' for the options parameter
  async set(key: string, value: string, options?: SetOptions) {
    return this.client.set(this.applyPrefix(key), value, options);
  }

  async getJSON<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    return raw ? JSON.parse(raw) : null;
  }

  async setJSON<T>(key: string, value: T, ttl?: number) {
    const payload = JSON.stringify(value);
    return this.set(
      key,
      payload,
      ttl ? { expiration: { type: 'EX', value: ttl } } : undefined
    );
  }

  // Fallback to allow direct client access if needed (unprefixed)
  get native() {
    return this.client;
  }
}

/**
 * Returns a wrapper. Reuses a connection if the URL has been seen before.
 */
export const getTenantRedis = async (tenantId: string, url?: string): Promise<TenantRedisWrapper> => {
  const targetUrl = url || process.env.TENANT_REDIS_URI || process.env.REDIS_URI || '';

  // Check for an existing connection to this specific Redis URL
  let client = connectionPools.get(targetUrl);

  if (!client) {
    client = createClient({ url: targetUrl });
    client.on('error', (err) => logger.error({ message: `Redis Connection Error [${targetUrl}]:`, args: [err] }));

    await client.connect();
    connectionPools.set(targetUrl, client);
  }

  // Return a new wrapper instance using the client from the pool
  return new TenantRedisWrapper(client, tenantId);
};

/**
 * Cleanup: Gracefully closes every unique connection in the pool
 */
export const closeAllRedis = async () => {
  const quitPromises = Array.from(connectionPools.values()).map(client => client.quit());
  await Promise.all(quitPromises);
  connectionPools.clear();
};
