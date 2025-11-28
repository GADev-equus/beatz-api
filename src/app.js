import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import config from './config/env.js';
import healthRouter from './routes/health.js';
import apiV1Router from './routes/v1/index.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';
import { withClerkMiddleware } from './middleware/auth.js';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

const corsOptions = {
  origin: config.corsOrigins.length ? config.corsOrigins : true,
  credentials: true,
};

app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  morgan(config.logFormat, {
    skip: () => config.env === 'test',
  })
);

// Attach Clerk auth context if configured
app.use(withClerkMiddleware);

app.use('/health', healthRouter);
app.use(`${config.apiPrefix}/${config.apiVersion}`, apiV1Router);

app.use(notFound);
app.use(errorHandler);

export default app;
