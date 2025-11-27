const formatMessage = (level, message, meta) => {
  const timestamp = new Date().toISOString();
  if (!meta || Object.keys(meta).length === 0) return `[${timestamp}] [${level}] ${message}`;
  return `[${timestamp}] [${level}] ${message} ${JSON.stringify(meta)}`;
};

const logger = {
  info: (message, meta = {}) => console.info(formatMessage('INFO', message, meta)),
  warn: (message, meta = {}) => console.warn(formatMessage('WARN', message, meta)),
  error: (message, meta = {}) => console.error(formatMessage('ERROR', message, meta)),
};

export default logger;
