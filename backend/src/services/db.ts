import mongoose from 'mongoose';
import { logger } from '../utils/logging/index.js';
import { AppError } from '../utils/errors/index.js';

/**
 * Connect to MongoDB using URI and Database Name from environment variables.
 * We ensure high availability by letting Mongoose handle connection pooling internally.
 */
export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB;

  if (!uri || !dbName) {
    throw new AppError('MongoDB URI or Database Name is missing in environment variables', 500);
  }

  try {
    await mongoose.connect(uri, {
      dbName: dbName,
    });

    logger.info({
      message: 'MongoDB connected',
      color: logger.colors.SUCCESS,
      args: [dbName],
    })
  } catch (err) {
    logger.error({
      message: 'MongoDB connection error',
      args: [err],
    })
    // For critical infrastructure failure, we exit the process
    process.exit(1);
  }
}

/**
 * Gracefully disconnect from MongoDB.
 * Essential for clean shutdowns in containerized environments.
 */
export const disconnectDB = async (): Promise<void> => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      logger.info({
        message: 'MongoDB disconnected',
        color: logger.colors.SYSTEM_INFO,
      });
    }
  } catch (err) {
    logger.error({
      message: 'MongoDB disconnection error',
      args: [err],
    })
  }
}
