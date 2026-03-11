import mongoose, { Connection, Model } from 'mongoose';
import { logger } from '../utils/logging/index.js';
import { AppError } from '../utils/errors/index.js';
import {
  ISiteConfiguration,
  SiteConfigurationSchema,
} from '../models/index.js';

// Global singleton for the primary/config database
export let baseConnection: Connection;
const tenantDbCache = new Map<string, Connection>();

// SASS Models
export let SiteConfiguration: Model<ISiteConfiguration>;

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB; // Your 'config' or 'admin' DB name

  if (!uri || !dbName) {
    throw new AppError('MongoDB URI or Base Database Name is missing', 500);
  }

  try {
    // Create the persistent base connection
    baseConnection = mongoose.createConnection(uri, {
      dbName: dbName,
      maxPoolSize: 100, // Shared pool for all future useDb() calls
    });

    await new Promise((resolve, reject) => {
      baseConnection.once('open', resolve);
      baseConnection.once('error', reject);
    });

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
 * Returns a cached or new connection to a tenant-specific database.
 */
export const getTenantDb = (dbName: string): Connection => {
  if (tenantDbCache.has(dbName)) {
    return tenantDbCache.get(dbName)!;
  }

  // useDb shares the baseConnection's underlying pool
  const tenantDb = baseConnection.useDb(dbName, { useCache: true });

  tenantDbCache.set(dbName, tenantDb);
  return tenantDb;
};

/**
 * Gracefully disconnect from MongoDB.
 * Essential for clean shutdowns in containerized environments.
 */
export const disconnectDB = async (): Promise<void> => {
  try {
    // Check if our specific baseConnection exists and is active
    if (baseConnection && baseConnection.readyState !== 0) {
      // .close() terminates the entire pool, including all useDb() instances
      await baseConnection.close();

      // Clear our local JS cache to prevent memory leaks/stale references
      tenantDbCache.clear();

      logger.info({
        message: 'MongoDB Base and Tenant connections disconnected',
        color: logger.colors.SYSTEM_INFO,
      });
    }
  } catch (err) {
    logger.error({
      message: 'MongoDB disconnection error',
      args: [err],
    });
  }
};
