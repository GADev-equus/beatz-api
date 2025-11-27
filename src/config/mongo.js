import mongoose from 'mongoose';
import config from './env.js';
import logger from '../utils/logger.js';

mongoose.set('strictQuery', true);

let isConnected = false;

export async function connectMongo() {
  if (!config.mongo.uri) {
    logger.warn('MONGO_URL not set; skipping Mongo connection.');
    return;
  }

  if (isConnected) return;

  try {
    await mongoose.connect(config.mongo.uri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: false,
    });
    isConnected = true;
    logger.info('MongoDB connected.');
  } catch (err) {
    logger.error('MongoDB connection failed.', { error: err.message });
    throw err;
  }
}

export async function disconnectMongo() {
  if (!isConnected) return;
  await mongoose.connection.close();
  isConnected = false;
  logger.info('MongoDB connection closed.');
}
