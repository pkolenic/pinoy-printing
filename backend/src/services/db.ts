import mongoose, { Connection, Model } from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import { logger } from '../utils/logging/index.js';
import { AppError } from '../utils/errors/index.js';
import {
  ISiteConfiguration,
  SiteConfigurationSchema,
} from '../models/index.js';

// Caches
const dbPools = new Map<string, Connection>();    // url -> Pool Connection
const tenantDbCache = new Map<string, Connection>(); // dbName -> Specific Database instance

// SASS Model Singleton
export let SiteConfiguration: Model<ISiteConfiguration>;

/**
 * Initializes the primary configuration database.
 * This is used for storing global configuration settings for SASS operations.
 * Sets up the base pool with a maxPoolSize of 100.
 */
export const connectDB = async (): Promise<void> => {
  const url = process.env.MONGO_URL;
  const dbName = process.env.MONGO_DB;

  if (!url || !dbName) {
    throw new AppError('MongoDB URI or Base Database Name is missing', StatusCodes.INTERNAL_SERVER_ERROR);
  }

  try {
    // Create the persistent base connection
    const baseConnection = mongoose.createConnection(url, {
      dbName: dbName,
      maxPoolSize: 100, // Large pool for primary/shared cluster
    });

    await new Promise((resolve, reject) => {
      baseConnection.once('open', resolve);
      baseConnection.once('error', reject);
    });

    // Store in our unified pool map
    dbPools.set(url, baseConnection);

    // Initialize the SiteConfiguration model
    SiteConfiguration = baseConnection.model<ISiteConfiguration>('SiteConfiguration', SiteConfigurationSchema);

    logger.info({
      message: 'Base MongoDB Connected (Config Store)',
      args: [dbName],
    });
  } catch (err) {
    logger.error({ message: 'Base MongoDB connection failed', args: [err] });
    process.exit(1);
  }
};

/**
 * Returns a cached or new connection.
 * Reuses existing pools if the URL matches, otherwise creates a new one (size 25).
 */
export const getTenantDb = async (config: ISiteConfiguration): Promise<Connection> => {
  const { name: dbName, url: tenantUrl } = config.backend?.database || {};

  // Validation - Fail early if the name or url is missing
  if (!dbName || !tenantUrl) {
    throw new AppError(
      `Invalid database configuration for tenant: ${config.tenantId}`,
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }

  // Check if we already have the specific database instance cached
  if (tenantDbCache.has(dbName)) {
    return tenantDbCache.get(dbName)!;
  }

  // Check if we have a pool for this cluster URL
  let targetPool = dbPools.get(tenantUrl);

  if (!targetPool) {
    logger.info({ message: `Creating new dedicated connection pool for cluster: ${tenantUrl}` });

    targetPool = mongoose.createConnection(tenantUrl, {
      maxPoolSize: 25 // Reduced pool size for dedicated tenant clusters
    });

    try {
      await new Promise((resolve, reject) => {
        targetPool!.once('open', resolve);
        targetPool!.once('error', reject);
      });
      dbPools.set(tenantUrl, targetPool);
    } catch (err) {
      throw new AppError(`Failed to connect to tenant cluster: ${tenantUrl}`, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  // Create the database instance within that pool
  const tenantDb = targetPool.useDb(dbName, { useCache: true });
  tenantDbCache.set(dbName, tenantDb);

  return tenantDb;
};

/**
 * Gracefully disconnects all pools (Base and Tenant-specific clusters).
 * Essential for clean shutdowns in containerized environments.
 */
export const disconnectDB = async (): Promise<void> => {
  try {
    const closePromises = Array.from(dbPools.values()).map(pool => {
      if (pool.readyState !== 0) {
        return pool.close();
      }
      return Promise.resolve();
    });

    await Promise.all(closePromises);

    // Clear memory references
    dbPools.clear();
    tenantDbCache.clear();

    logger.info({
      message: 'All MongoDB pools and connections disconnected gracefully',
      color: logger.colors.SYSTEM_INFO,
    });
  } catch (err) {
    logger.error({
      message: 'Error during MongoDB global disconnect',
      args: [err],
    });
  }
};

