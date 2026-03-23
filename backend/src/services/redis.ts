import { createClient, SetOptions } from "redis";
import { logger } from '../utils/logging/index.js';
import { AppError } from "../utils/errors/index.js";
import { StatusCodes } from "http-status-codes";

// Derived type for the Redis client
type RedisClient = ReturnType<typeof createClient>;

export default class Redis {
  private static instance: Redis | null = null;
  private static initPromise: Promise<Redis> | null = null;
  private readonly client: RedisClient;

  private constructor(client: RedisClient) {
    this.client = client;
  }

  /**
   * Public static method to establish a singleton connection.
   */
  public static async connect(): Promise<Redis> {
    return this.getInstance();
  }

  /**
   * Public static method to gracefully shut down the singleton connection.
   */
  public static async disconnect(): Promise<void> {
    // If there's an active connection process, wait for it to finish first
    if (this.initPromise) {
      try {
        await this.initPromise;
      } catch (err) {
        logger.error({ message: 'Error during Redis disconnect:', args: [err] });
      }
    }

    // 2. If an instance exists, quit the underlying client
    if (this.instance) {
      await this.instance.client.quit();

      // 3. CRITICAL: Reset the singleton state
      this.instance = null;
      this.initPromise = null;
      logger.info({ message: 'Redis connection closed gracefully.' });
    }
  }

  /**
   * Public static method to get the singleton instance.
   * If the instance doesn't exist or is closed, it will be created and initialized.
   */
  public static async getInstance(): Promise<Redis> {
    // Check if the instance exists AND the underlying client is still alive
    if (this.instance && this.instance.client.isOpen) {
      return this.instance;
    }

    // If the instance exists but is closed, clean up before trying again
    if (this.instance && !this.instance.client.isOpen) {
      this.instance = null;
      this.initPromise = null;
    }

    if (!this.initPromise) {
      this.initPromise = (async () => {
        const url = process.env.REDIS_URI;
        const client = createClient({
          url,
          socket: {
            // Automatic reconnection logic
            reconnectStrategy: (retries) => {
              if (retries > 10) {
                logger.error({ message: "Redis reconnection failed after 10 attempts. Stopping." });
                return new AppError("Redis reconnection failed", StatusCodes.INTERNAL_SERVER_ERROR);
              }
              // Exponential backoff: 100ms, 200ms, 400ms... up to 2 seconds
              const delay = Math.min(Math.pow(2, retries) * 50, 2000);
              logger.warn({ message: `Redis reconnecting... Attempt ${retries}. Retrying in ${delay}ms` });
              return delay;
            }
          }
        });

        client.on('error', (err) => logger.error({
          message: `Redis Error [${url}]:`,
          args: [err]
        }));

        try {
          await client.connect();
          this.instance = new Redis(client);
          return this.instance;
        } catch (error) {
          // Clear the promise so the next call to getInstance() can try again
          this.initPromise = null;

          throw new AppError(
            `Failed to establish initial Redis connection at ${url}`,
            StatusCodes.INTERNAL_SERVER_ERROR
          );
        }
      })();
    }

    return this.initPromise;
  }

  /**
   * Ensures the client is connected before performing operations.
   */
  private async _ensureClient(): Promise<RedisClient> {
    if (!this.client.isOpen) {
      // This triggers your self-healing logic in getInstance
      const fresh = await Redis.getInstance();
      return fresh.client;
    }
    return this.client;
  }

  /**
   * Helper to handle all read operations with logging
   */
  private async _read<T>(key: string, parse?: (val: string) => T): Promise<T | null> {
    const client = await this._ensureClient();
    const raw = await client.get(key);

    if (raw == null) {
      logger.debug({
        message: 'Cache miss:',
        color: logger.colors.SYSTEM_DEBUG,
        args: [{ key }]
      });
      return null;
    }

    logger.debug({
      message: 'Cache hit:',
      color: logger.colors.SYSTEM_DEBUG,
      args: [{ key }]
    });

    return parse ? parse(raw) : (raw as unknown as T);
  }

  /**
   * Helper to handle all write operations with logging
   */
  private async _write<T>(key: string, value: T, options?: SetOptions, serialize?: (val: T) => string): Promise<string | null> {
    const client = await this._ensureClient();
    const payload = serialize ? serialize(value) : (value as unknown as string);

    logger.debug({
      message: 'Cache write:',
      color: logger.colors.SYSTEM_DEBUG,
      args: [{ key }, { options }]
    });

    return client.set(
      key,
      payload,
      options,
    );
  }

  // Support for single or multiple key deletion
  async del(key: string | string[]) {
    const client = await this._ensureClient();
    return client.del(key);
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
}
