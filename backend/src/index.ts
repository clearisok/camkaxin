import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import agentsRouter from './routes/agents.js';
import brandsRouter from './routes/brands.js';
import fabricsRouter from './routes/fabrics.js';
import accessoriesRouter from './routes/accessories.js';
import settingsRouter from './routes/settings.js';
import quotationsRouter from './routes/quotations.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '50mb' }));
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
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/agents', agentsRouter);
app.use('/api/brands', brandsRouter);
app.use('/api/fabrics', fabricsRouter);
app.use('/api/accessories', accessoriesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/quotations', quotationsRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`柬凯报价模块 API 运行于 http://localhost:${PORT}`);
  console.log(`Swagger 文档: http://localhost:${PORT}/api-docs`);
});

export default app;
