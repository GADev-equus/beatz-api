import dotenv from 'dotenv';

dotenv.config();

const required = (name, fallback) => {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === null || value === '') {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
};

const toNumber = (name, value, fallback) => {
  const numeric = Number(value ?? fallback);
  if (Number.isNaN(numeric)) {
    throw new Error(`Environment variable ${name} must be a number`);
  }
  return numeric;
};

const parseOrigins = (raw) => {
  if (!raw) return [];
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const env = process.env.NODE_ENV || 'development';

const stripSlashes = (value = '') => value.replace(/^\/+|\/+$/g, '');

const normalizeApiBasePath = (prefixRaw, versionRaw) => {
  const prefix = `/${stripSlashes(prefixRaw || '/api')}`;
  const version = stripSlashes(versionRaw || 'v1');
  if (!version) return prefix;
  return prefix.endsWith(`/${version}`) ? prefix : `${prefix}/${version}`;
};

const config = Object.freeze({
  env,
  isProduction: env === 'production',
  port: toNumber('PORT', process.env.PORT, 8000),
  apiPrefix: `/${stripSlashes(process.env.API_PREFIX || '/api')}`,
  apiVersion: stripSlashes(process.env.API_VERSION || 'v1'),
  apiBasePath: normalizeApiBasePath(process.env.API_PREFIX, process.env.API_VERSION),
  corsOrigins: parseOrigins(process.env.CORS_ORIGINS),
  logFormat: process.env.MORGAN_FORMAT || (env === 'production' ? 'combined' : 'dev'),
  clerk: {
    secretKey: process.env.CLERK_SECRET_KEY || '',
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY || '',
  },
  mongo: {
    uri: process.env.MONGO_URL || '',
    dbName: process.env.MONGO_DB_NAME || '',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
});

export default config;

export { required };
