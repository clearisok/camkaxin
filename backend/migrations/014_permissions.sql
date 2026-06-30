-- 迭代 2：功能权限

CREATE TABLE IF NOT EXISTS permissions (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(128) NOT NULL UNIQUE,
  name        VARCHAR(128) NOT NULL,
  module      VARCHAR(64) NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);
