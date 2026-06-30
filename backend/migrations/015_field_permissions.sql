-- 迭代 3：字段级权限

CREATE TABLE IF NOT EXISTS role_field_permissions (
  role_id     INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  field_code  VARCHAR(128) NOT NULL,
  visible     BOOLEAN NOT NULL DEFAULT TRUE,
  editable    BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (role_id, field_code)
);

CREATE INDEX IF NOT EXISTS idx_role_field_permissions_code ON role_field_permissions(field_code);
