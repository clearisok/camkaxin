import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { ensureBeijingProcessTimezone, formatDateTimeBeijing } from './utils/beijingTime.js';
import agentsRouter from './routes/agents.js';
import brandsRouter from './routes/brands.js';
import fabricsRouter from './routes/fabrics.js';
import accessoriesRouter from './routes/accessories.js';
import settingsRouter from './routes/settings.js';
import quotationsRouter from './routes/quotations.js';
import stylesRouter from './routes/styles.js';
import calendarExceptionsRouter from './routes/calendarExceptions.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import { authenticate } from './middleware/auth.js';
import { routePermissionGuard } from './middleware/routePermissionGuard.js';

ensureBeijingProcessTimezone();
dotenv.config();

export function createApp(): express.Express {
  const app = express();
  const PORT = process.env.PORT || 3001;
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '50mb' }));

  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in (err as SyntaxError & { body?: unknown })) {
      res.status(400).json({ error: '请求体 JSON 格式无效' });
      return;
    }
    next(err);
  });

  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  const swaggerOptions = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: '柬凯报价模块 API',
        version: '1.0.0',
        description: '柬凯内部管理系统 - 报价模块 RESTful API 文档',
      },
      servers: [{ url: `http://localhost:${PORT}`, description: '开发服务器' }],
    },
    apis: ['./src/routes/*.ts'],
  };

  const swaggerSpec = swaggerJsdoc(swaggerOptions);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: formatDateTimeBeijing(new Date()), timezone: 'Asia/Shanghai' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api', authenticate);
  app.use('/api', routePermissionGuard);

  app.use('/api/admin', adminRouter);
  app.use('/api/agents', agentsRouter);
  app.use('/api/brands', brandsRouter);
  app.use('/api/fabrics', fabricsRouter);
  app.use('/api/accessories', accessoriesRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/quotations', quotationsRouter);
  app.use('/api/styles', stylesRouter);
  app.use('/api/calendar-exceptions', calendarExceptionsRouter);

  const staticDir = process.env.STATIC_DIR
    ? path.resolve(process.cwd(), process.env.STATIC_DIR)
    : path.resolve(process.cwd(), '../frontend/dist');
  const indexHtml = path.join(staticDir, 'index.html');

  if (fs.existsSync(indexHtml)) {
    app.use(express.static(staticDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/api-docs') || req.path.startsWith('/uploads')) {
        next();
        return;
      }
      res.sendFile(indexHtml);
    });
  }

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: err.message });
  });

  return app;
}
