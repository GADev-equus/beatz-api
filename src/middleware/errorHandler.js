import config from '../config/env.js';
import logger from '../utils/logger.js';

const errorHandler = (err, req, res, _next) => {
  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';

  logger.error(message, {
    status,
    path: req.originalUrl,
    method: req.method,
    stack: config.isProduction ? undefined : err.stack,
  });

  const payload = {
    error: message,
  };

  if (!config.isProduction) {
    payload.stack = err.stack;
  }

  res.status(status).json(payload);
};

export default errorHandler;
