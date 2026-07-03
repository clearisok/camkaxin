import { createApp } from './app.js';
import { ensureSchedulingSchema } from './db/ensureSchedulingSchema.js';
import { seedDefaultRolesAndPermissions } from './services/permissionService.js';
import { seedDefaultFieldPermissions } from './services/fieldPermissionService.js';
import { ensureCalendarSchema } from './db/ensureCalendarSchema.js';
import { ensureAuthSchema } from './db/ensureAuthSchema.js';
import { ensureClosingLockSchema } from './db/ensureClosingLockSchema.js';

const app = createApp();
const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await ensureAuthSchema();
    await ensureSchedulingSchema();
    await ensureCalendarSchema();
    await ensureClosingLockSchema();
    await seedDefaultRolesAndPermissions();
    await seedDefaultFieldPermissions();
  } catch (err) {
    console.error('数据库字段自检失败，请运行 npm run db:migrate：', err);
  }

  app.listen(PORT, () => {
    console.log(`柬凯报价模块 API 运行于 http://localhost:${PORT}`);
    console.log(`Swagger 文档: http://localhost:${PORT}/api-docs`);
  });
}

start();

export default app;
