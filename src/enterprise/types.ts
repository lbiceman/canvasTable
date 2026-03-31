// ============================================================
// ICE Excel 企业版 - 类型定义
// ============================================================

/** 用户角色 */
export type UserRole = 'superAdmin' | 'tenantAdmin' | 'member' | 'guest';

/** 协作权限角色 */
export type CollabRole = 'admin' | 'editor' | 'readOnly' | 'guest';

/** 认证方式 */
export type AuthMethod = 'password' | 'oauth2' | 'saml' | 'ldap';

/** 登录用户信息 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
  avatarUrl?: string;
  authMethod: AuthMethod;
  token: string;
  refreshToken?: string;
  tokenExpiry: number;
}

/** 登录请求 */
export interface LoginRequest {
  email: string;
  password: string;
}

/** 登录响应 */
export interface LoginResponse {
  success: boolean;
  user?: AuthUser;
  error?: string;
  lockoutUntil?: number;
}

/** 权限矩阵定义 */
export interface PermissionMatrix {
  view: boolean;
  edit: boolean;
  format: boolean;
  protect: boolean;
  export: boolean;
}

/** 角色权限映射 */
export const ROLE_PERMISSIONS: Record<CollabRole, PermissionMatrix> = {
  admin: { view: true, edit: true, format: true, protect: true, export: true },
  editor: { view: true, edit: true, format: true, protect: false, export: true },
  readOnly: { view: true, edit: false, format: false, protect: false, export: true },
  guest: { view: true, edit: false, format: false, protect: false, export: false },
};

/** 工作表保护配置 */
export interface SheetProtection {
  enabled: boolean;
  passwordHash?: string;
  allowEditCells: boolean;
  allowFormatCells: boolean;
  allowInsertRows: boolean;
  allowUndoRedo: boolean;
  lockedRanges: LockedRange[];
}

/** 锁定区域 */
export interface LockedRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  passwordHash?: string;
}

/** 审计日志事件类型 */
export type AuditEventCategory = 'auth' | 'permission' | 'data' | 'admin';

export type AuditEventType =
  // 认证事件
  | 'LOGIN' | 'LOGIN_FAILED' | 'LOGOUT' | 'TOKEN_REFRESH' | 'PASSWORD_CHANGE' | 'SSO_ASSERTION'
  // 权限事件
  | 'PERMISSION_GRANT' | 'PERMISSION_REVOKE' | 'ROLE_CHANGE' | 'SHARE_CREATED' | 'SHARE_REVOKED'
  // 数据事件
  | 'CELL_EDIT' | 'CELL_PROTECT' | 'SHEET_LOCK' | 'SHEET_UNLOCK' | 'BULK_UPDATE' | 'DATA_EXPORTED'
  // 管理事件
  | 'USER_INVITED' | 'USER_REMOVED' | 'POLICY_CHANGED' | 'WORKBOOK_CREATED';

/** 审计日志条目 */
export interface AuditLogEntry {
  id: string;
  timestamp: number;
  userId: string;
  userName: string;
  eventType: AuditEventType;
  category: AuditEventCategory;
  target: string;
  detail: string;
  ip: string;
}

/** 审计日志查询参数 */
export interface AuditLogQuery {
  category?: AuditEventCategory;
  userId?: string;
  startTime?: number;
  endTime?: number;
  page: number;
  pageSize: number;
}

/** 审计日志查询结果 */
export interface AuditLogResult {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

/** 房间用户权限信息 */
export interface RoomUserPermission {
  userId: string;
  userName: string;
  role: CollabRole;
  online: boolean;
  color?: string;
}
