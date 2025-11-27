import app from './app.js';
import config from './config/env.js';
import logger from './utils/logger.js';
import { connectMongo, disconnectMongo } from './config/mongo.js';

async function start() {
  await connectMongo();

  const server = app.listen(config.port, () => {
    logger.info(`API server listening on port ${config.port}`);
  });

  const gracefulShutdown = (signal) => {
    logger.info(`${signal} received. Closing server...`);
    server.close(async () => {
      logger.info('HTTP server closed.');
      await disconnectMongo().catch((err) => logger.error('Mongo disconnect failed', { error: err.message }));
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Force exiting after graceful shutdown timeout.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason });
    gracefulShutdown('unhandledRejection');
  });
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    gracefulShutdown('uncaughtException');
  });
}

start().catch((err) => {
  logger.error('Failed to start server.', { error: err.message });
  process.exit(1);
});
