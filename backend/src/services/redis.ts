import { createClient } from "redis";
import { logger } from '../utils/logging/index.js';

// Precise typing for v5 (Solves IDE performance lag)
export type RedisClient = ReturnType<typeof createClient>;

interface ReadOptions<T> {
  parse?: (raw: string) => T;
}

interface WriteOptions<T> {
  ttlSeconds?: number;
  serialize?: (value: T) => string;
}

/**
 * Wrapper for Node-Redis v5
 * Supports single connection and graceful shutdown
 */
class RedisSingleton {
  public client: RedisClient;
  private _connectPromise: Promise<RedisClient> | null = null;

  constructor({ url }: { url: string | undefined }) {
    // Node-Redis v5 prefers URL-based connection
    this.client = createClient({ url });

    // Useful diagnostics
    this.client.on('error', (err) => logger.error({message: 'Redis Error:', args: [err]}));
    this.client.on('connect', () => logger.info({ message: 'Redis connected', color: logger.colors.SYSTEM_INFO }));
    this.client.on('reconnecting', () => logger.info({ message: 'Redis reconnecting', color: logger.colors.SYSTEM_INFO }));
    this.client.on('end', () => {
      this._connectPromise = null;
      logger.info({ message: 'Redis disconnected', color: logger.colors.SYSTEM_INFO });
    });
  }

  // Ensure a single connection attempt and reuse it
  async connect(): Promise<RedisClient> {
    if (!this._connectPromise) {
      this._connectPromise = this.client.connect().then(() => {
        return this.client;
      })
        .catch((err) => {
          this._connectPromise = null;
          throw err;
        });
    }
    return this._connectPromise;
  }

  // --- Internal Helpers ---
  private async _read<T = string>(key: string, options: ReadOptions<T> = {}): Promise<T | null> {
    await this.connect();
    const raw = await this.client.get(key);
    if (raw == null) {
      logger.debug({ message: 'Cache miss:', color: logger.colors.SYSTEM_DEBUG, args: [key] });
      return null;
    }
    logger.debug({ message: 'Cache hit:', color: logger.colors.SYSTEM_DEBUG, args: [key] });
    return options.parse ? options.parse(raw) : (raw as unknown as T);
  }

  private async _write<T = string>(key: string, value: T, options: WriteOptions<T> = {}): Promise<string | null> {
    await this.connect();
    const payload = options.serialize ? options.serialize(value) : (value as unknown as string);

    // Node-Redis v5 uses the same options object for TTL
    logger.debug({ message: 'Cache write:', color: logger.colors.SYSTEM_DEBUG, args: [key, `(TTL:${options.ttlSeconds})`] });
    return this.client.set(key, payload, options.ttlSeconds ? { EX: options.ttlSeconds } : undefined);
  }

  // --- Public API built on top of the helpers ---

  // String get
  async get(key: string): Promise<string | null> {
    return this._read(key);
  }

  // String set
  async set(key: string, value: string, ttlSeconds?: number): Promise<string | null> {
    return this._write(key, value, { ttlSeconds });
  }

  // JSON get
  async getJSON<T>(key: string): Promise<T | null> {
    return this._read<T>(key, { parse: JSON.parse });
  }

  // JSON set
  async setJSON<T>(key: string, value: T, ttlSeconds?: number): Promise<string | null> {
    return this._write<T>(key, value, { ttlSeconds, serialize: JSON.stringify });
  }

  /**
   * Graceful Shutdown (v5.9.0 Standard)
   */
  async close(): Promise<void> {
    try {
      if (this.client.isOpen) {
        await this.client.close();
      }
    } catch (e: any) {
      logger.error({ message: 'Error on Close',  args: [e] });
    } finally {
      this._connectPromise = null;
    }
  }
}

/**
 * Type-Safe Proxy Wrapper for v5
 */
type RedisWrapper = RedisSingleton & RedisClient;

function wrap(singleton: RedisSingleton): RedisWrapper {
  return new Proxy(singleton, {
    get(target: any, prop: string | symbol, receiver: any) {
      // If it's a member on the wrapper (e.g., connect, getJSON), use it.
      if (prop in target) return Reflect.get(target, prop, receiver);

      // Otherwise, forward to the client after connecting.
      return async (...args: any[]) => {
        await target.connect();
        const member = target.client[prop];
        // Non-function properties are returned directly
        if (typeof member !== 'function') return member;
        // Call the client method with provided args
        return member.apply(target.client, args);
      };
    },
  }) as RedisWrapper;
}

// Default client
const redis = wrap(new RedisSingleton({ url: process.env.REDIS_URI }));
export default redis;
