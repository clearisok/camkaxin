import dotenv from 'dotenv';
import { pool, query } from '../src/config/database.js';
import { ensureAuthSchema } from '../src/db/ensureAuthSchema.js';
import { hashPassword } from '../src/services/authService.js';
import { seedDefaultRolesAndPermissions } from '../src/services/permissionService.js';
import { seedDefaultFieldPermissions } from '../src/services/fieldPermissionService.js';

dotenv.config();

const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD || 'admin123';

async function seedAuth() {
  await ensureAuthSchema();
  await seedDefaultRolesAndPermissions();
  await seedDefaultFieldPermissions();

  const adminRoleRes = await query<{ id: number }>("SELECT id FROM roles WHERE code = 'admin'");
  const adminRoleId = adminRoleRes.rows[0]?.id;
  if (!adminRoleId) {
    throw new Error('无法创建 admin 角色');
  }

  const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);

  const userRes = await query<{ id: number }>(
    `INSERT INTO users (username, display_name, password_hash, is_super_admin, status)
     VALUES ($1, $2, $3, TRUE, 'active')
     ON CONFLICT (username) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       password_hash = EXCLUDED.password_hash,
       is_super_admin = TRUE,
       status = 'active',
       updated_at = NOW()
     RETURNING id`,
    [DEFAULT_ADMIN_USERNAME, '系统管理员', passwordHash],
  );
  const adminUserId = userRes.rows[0].id;

  await query(
    `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)
     ON CONFLICT (user_id, role_id) DO NOTHING`,
    [adminUserId, adminRoleId],
  );

  console.log('Auth seed completed.');
  console.log(`  管理员账号: ${DEFAULT_ADMIN_USERNAME}`);
  console.log(`  初始密码: ${DEFAULT_ADMIN_PASSWORD}`);
  console.log('  默认角色: admin, quotation_manager, sales, scheduler, viewer');
  console.log('  请在首次登录后修改密码。');
}

seedAuth()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
