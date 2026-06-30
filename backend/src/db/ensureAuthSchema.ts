import { query } from '../config/database.js';

/** 启动时确保认证相关表存在（与 migrations/013_auth_rbac.sql 一致） */
export async function ensureAuthSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id              SERIAL PRIMARY KEY,
      username        VARCHAR(64) NOT NULL UNIQUE,
      display_name    VARCHAR(128),
      password_hash   VARCHAR(255) NOT NULL,
      email           VARCHAR(128),
      status          VARCHAR(16) NOT NULL DEFAULT 'active',
      is_super_admin  BOOLEAN NOT NULL DEFAULT FALSE,
      last_login_at   TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS roles (
      id          SERIAL PRIMARY KEY,
      code        VARCHAR(64) NOT NULL UNIQUE,
      name        VARCHAR(128) NOT NULL,
      description TEXT,
      is_system   BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, role_id)
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
  await query('CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)');

  await query(`
    CREATE TABLE IF NOT EXISTS permissions (
      id          SERIAL PRIMARY KEY,
      code        VARCHAR(128) NOT NULL UNIQUE,
      name        VARCHAR(128) NOT NULL,
      module      VARCHAR(64) NOT NULL,
      sort_order  INT NOT NULL DEFAULT 0
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id       INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module)');

  await query(`
    CREATE TABLE IF NOT EXISTS role_field_permissions (
      role_id     INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      field_code  VARCHAR(128) NOT NULL,
      visible     BOOLEAN NOT NULL DEFAULT TRUE,
      editable    BOOLEAN NOT NULL DEFAULT FALSE,
      PRIMARY KEY (role_id, field_code)
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_role_field_permissions_code ON role_field_permissions(field_code)');
}
