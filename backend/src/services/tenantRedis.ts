import { createClient } from "redis";
import { logger } from '../utils/logging/index.js';

export type RedisClient = ReturnType<typeof createClient>;
const tenantClients = new Map<string, any>();

export class TenantRedisWrapper {
  private client: RedisClient;
  private prefix: string;

  constructor(client: RedisClient, tenantId: string) {
    this.client = client;
    this.prefix = `tenant:${tenantId}`; // Standard hierarchical namespace
  }

  private applyPrefix(key: string) { return `${this.prefix}::${key}`; }

  // Scoped helper methods
  async get(key: string) { return this.client.get(this.applyPrefix(key)); }

  async set(key: string, value: string, options?: any) {
    return this.client.set(this.applyPrefix(key), value, options);
  }

  async getJSON<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    return raw ? JSON.parse(raw) : null;
  }

  async setJSON<T>(key: string, value: T, ttl?: number) {
    const payload = JSON.stringify(value);
    return this.set(key, payload, ttl ? { EX: ttl } : undefined);
  }

  // Fallback to allow direct client access if needed (unprefixed)
  get native() { return this.client; }
}

/**
 * Returns a cached connection for the tenant.
 * If your tenants share a single Redis instance, use the same URL.
 */
export const getTenantRedis = async (tenantId: string, url?: string): Promise<TenantRedisWrapper> => {
  if (tenantClients.has(tenantId)) {
    return tenantClients.get(tenantId);
  }

  const client = createClient({ url: url || process.env.TENANT_REDIS_URI || process.env.REDIS_URI });

  client.on('error', (err) => logger.error({ message: `Redis Error [${tenantId}]:`, args: [err] }));

  await client.connect();

  const wrapped = new TenantRedisWrapper(client, tenantId);
  tenantClients.set(tenantId, wrapped);

  return wrapped;
};

/**
 * Cleanup all tenant connections
 */
export const closeAllRedis = async () => {
  for (const [_id, wrapped] of tenantClients.entries()) {
    await wrapped.native.quit();
  }
  tenantClients.clear();
};
