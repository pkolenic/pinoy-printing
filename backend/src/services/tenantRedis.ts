import { createClient, SetOptions } from "redis";
import { logger } from '../utils/logging/index.js';

// Derived type for the Redis client
export type RedisClient = ReturnType<typeof createClient>;

// Connection Pool: Maps "URL" -> "Connected Redis Client"
const connectionPools = new Map<string, RedisClient>();

export class TenantRedisWrapper {
  private client: RedisClient;
  private tenantId: string;
  private prefix: string;

  constructor(client: RedisClient, tenantId: string) {
    this.client = client;
    this.tenantId = tenantId;
    this.prefix = `tenant:${tenantId}`; // Standard hierarchical namespace
  }

  private applyPrefix(key: string): string {
    return `${this.prefix}::${key}`;
  }

  /**
   * Helper to handle all read operations with logging
   */
  private async _read<T>(key: string, parse?: (val: string) => T): Promise<T | null> {
    const prefixedKey = this.applyPrefix(key);
    const raw = await this.client.get(prefixedKey);

    if (raw == null) {
      logger.debug({
        message: 'Tenant Cache miss:',
        tenantId: this.tenantId,
        color: logger.colors.SYSTEM_DEBUG,
        args: [{ key: prefixedKey }]
      });
      return null;
    }

    logger.debug({
      message: 'Tenant Cache hit:',
      tenantId: this.tenantId,
      color: logger.colors.SYSTEM_DEBUG,
      args: [{ key: prefixedKey }]
    });

    return parse ? parse(raw) : (raw as unknown as T);
  }

  /**
   * Helper to handle all write operations with logging
   */
  private async _write<T>(key: string, value: T, options?: SetOptions, serialize?: (val: T) => string): Promise<string | null> {
    const prefixedKey = this.applyPrefix(key);
    const payload = serialize ? serialize(value) : (value as unknown as string);

    logger.debug({
      message: 'Tenant Cache write:',
      tenantId: this.tenantId,
      color: logger.colors.SYSTEM_DEBUG,
      args: [{ key: prefixedKey }, { options }]
    });

    // Modern node-redis (v4/v5) uses { EX: seconds } for TTL
    return this.client.set(
      prefixedKey,
      payload,
      options,
    );
  }

  // Scoped helper methods

  // Support for single or multiple key deletion
  async del(key: string | string[]) {
    const keys = Array.isArray(key) ? key.map(k => this.applyPrefix(k)) : this.applyPrefix(key);
    return this.client.del(keys);
  }

  async get(key: string): Promise<string | null> {
    return this._read<string>(key);
  }

  // Fixed Typing: Use SetOptions from 'redis' for the options parameter
  async set(key: string, value: string, options?: SetOptions): Promise<string | null> {
    return this._write(key, value, options);
  }

  async getJSON<T>(key: string): Promise<T | null> {
    return this._read<T>(key, JSON.parse);
  }

  async setJSON<T>(key: string, value: T, ttl?: number): Promise<string | null> {
    return this._write<T>(key, value, ttl ? { expiration: { type: 'EX', value: ttl } } : undefined, JSON.stringify);
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
    client.on('error', (err) => logger.error({
      message: `Redis Connection Error [${targetUrl}]:`,
      tenantId,
      args: [err]
    }));

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
