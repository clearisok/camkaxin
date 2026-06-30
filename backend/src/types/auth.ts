export interface FieldPermissionConfig {
  visible: boolean;
  editable: boolean;
}

export interface AuthUser {
  id: number;
  username: string;
  displayName: string | null;
  isSuperAdmin: boolean;
  roles: string[];
  permissions: string[];
  fieldPermissions: Record<string, FieldPermissionConfig>;
}

export interface JwtPayload {
  sub: number;
  username: string;
}
