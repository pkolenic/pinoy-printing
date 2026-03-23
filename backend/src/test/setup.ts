import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { beforeAll, afterAll, beforeEach } from 'vitest';

let mongodb: MongoMemoryServer;

beforeAll(async () => {
  // Spin up a fresh MongoDB instance
  mongodb = await MongoMemoryServer.create();
  const uri = mongodb.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  // Clean up connections
  await mongoose.disconnect();
  await mongodb.stop();
});

beforeEach(async () => {
  // Clear collections between tests to ensure isolation
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
