// ============================================================
// ICE Excel 企业版 - 权限服务
// ============================================================

import { CollabRole, PermissionMatrix, ROLE_PERMISSIONS, RoomUserPermission } from './types';

/** 权限服务：管理协作权限、角色检查 */
export class PermissionService {
  private currentRole: CollabRole = 'guest';
  private roomUsers: Map<string, RoomUserPermission> = new Map();
  private onPermissionChange: ((role: CollabRole) => void) | null = null;

  /** 注册权限变更回调 */
  setOnPermissionChange(callback: (role: CollabRole) => void): void {
    this.onPermissionChange = callback;
  }

  /** 设置当前用户角色 */
  setCurrentRole(role: CollabRole): void {
    this.currentRole = role;
    this.onPermissionChange?.(role);
  }

  /** 获取当前用户角色 */
  getCurrentRole(): CollabRole {
    return this.currentRole;
  }

  /** 获取当前权限矩阵 */
  getPermissions(): PermissionMatrix {
    return ROLE_PERMISSIONS[this.currentRole];
  }

  /** 检查是否有指定权限 */
  hasPermission(action: keyof PermissionMatrix): boolean {
    return ROLE_PERMISSIONS[this.currentRole][action];
  }

  /** 是否可以编辑 */
  canEdit(): boolean {
    return this.hasPermission('edit');
  }

  /** 是否可以格式化 */
  canFormat(): boolean {
    return this.hasPermission('format');
  }

  /** 是否可以设置保护 */
  canProtect(): boolean {
    return this.hasPermission('protect');
  }

  /** 是否可以导出 */
  canExport(): boolean {
    return this.hasPermission('export');
  }

  /** 是否为管理员 */
  isAdmin(): boolean {
    return this.currentRole === 'admin';
  }

  /** 更新房间用户列表 */
  updateRoomUsers(users: RoomUserPermission[]): void {
    this.roomUsers.clear();
    for (const user of users) {
      this.roomUsers.set(user.userId, user);
    }
  }

  /** 添加房间用户 */
  addRoomUser(user: RoomUserPermission): void {
    this.roomUsers.set(user.userId, user);
  }

  /** 移除房间用户 */
  removeRoomUser(userId: string): void {
    this.roomUsers.delete(userId);
  }

  /** 获取所有房间用户 */
  getRoomUsers(): RoomUserPermission[] {
    return Array.from(this.roomUsers.values());
  }

  /** 获取在线用户 */
  getOnlineUsers(): RoomUserPermission[] {
    return Array.from(this.roomUsers.values()).filter(u => u.online);
  }

  /** 检查角色是否可以授予目标角色（不能授予高于自身的角色） */
  canGrantRole(targetRole: CollabRole): boolean {
    const hierarchy: Record<CollabRole, number> = {
      admin: 3,
      editor: 2,
      readOnly: 1,
      guest: 0,
    };
    return hierarchy[this.currentRole] >= hierarchy[targetRole];
  }
}
