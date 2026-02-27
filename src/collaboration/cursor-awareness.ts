import { Selection, Viewport, RenderConfig } from '../types';
import { SpreadsheetModel } from '../model';
import { RemoteUser, USER_COLORS } from './types';

/**
 * 光标感知模块
 * 管理远程用户列表、颜色分配、选择区域更新，以及在 Canvas 上绘制远程光标
 */
export class CursorAwareness {
  // 远程用户映射表
  private remoteUsers: Map<string, RemoteUser> = new Map();
  // 已分配的颜色索引，用于追踪颜色池使用情况
  private usedColorIndices: Set<number> = new Set();
  // 用户ID到颜色索引的映射
  private userColorMap: Map<string, number> = new Map();
  // 待移除用户的定时器
  private removeTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /**
   * 为新用户分配唯一颜色
   * 从颜色池中选择第一个未被使用的颜色
   */
  private allocateColor(userId: string): string {
    // 如果用户已有颜色，直接返回
    const existingIndex = this.userColorMap.get(userId);
    if (existingIndex !== undefined) {
      return USER_COLORS[existingIndex];
    }

    // 找到第一个未使用的颜色索引
    for (let i = 0; i < USER_COLORS.length; i++) {
      if (!this.usedColorIndices.has(i)) {
        this.usedColorIndices.add(i);
        this.userColorMap.set(userId, i);
        return USER_COLORS[i];
      }
    }

    // 颜色池耗尽时，使用取模回绕
    const fallbackIndex = this.userColorMap.size % USER_COLORS.length;
    this.userColorMap.set(userId, fallbackIndex);
    return USER_COLORS[fallbackIndex];
  }

  /**
   * 释放用户占用的颜色
   */
  private releaseColor(userId: string): void {
    const index = this.userColorMap.get(userId);
    if (index !== undefined) {
      this.usedColorIndices.delete(index);
      this.userColorMap.delete(userId);
    }
  }

  /**
   * 添加远程用户
   */
  public addUser(user: RemoteUser): void {
    // 取消该用户的待移除定时器（如果有）
    const timer = this.removeTimers.get(user.userId);
    if (timer) {
      clearTimeout(timer);
      this.removeTimers.delete(user.userId);
    }

    // 分配颜色（如果用户未提供或需要覆盖）
    const color = user.color || this.allocateColor(user.userId);
    this.remoteUsers.set(user.userId, {
      ...user,
      color,
      lastActive: Date.now(),
    });
  }

  /**
   * 移除远程用户（2秒延迟后清除显示）
   */
  public removeUser(userId: string): void {
    // 如果已有定时器，先清除
    const existingTimer = this.removeTimers.get(userId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 2秒后移除用户
    const timer = setTimeout(() => {
      this.remoteUsers.delete(userId);
      this.releaseColor(userId);
      this.removeTimers.delete(userId);
    }, 2000);

    this.removeTimers.set(userId, timer);
  }

  /**
   * 更新远程用户的选择区域
   */
  public updateRemoteCursor(userId: string, selection: Selection | null): void {
    const user = this.remoteUsers.get(userId);
    if (user) {
      user.selection = selection;
      user.lastActive = Date.now();
    }
  }

  /**
   * 获取所有远程用户
   */
  public getRemoteUsers(): RemoteUser[] {
    return Array.from(this.remoteUsers.values());
  }

  /**
   * 获取指定用户
   */
  public getUser(userId: string): RemoteUser | undefined {
    return this.remoteUsers.get(userId);
  }

  /**
   * 在 Canvas 上渲染远程用户的选择边框和名称标签
   */
  public renderCursors(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    model: SpreadsheetModel,
    config: RenderConfig
  ): void {
    const { headerWidth, headerHeight } = config;
    const { scrollX, scrollY } = viewport;

    // 裁剪到单元格区域，避免绘制到标题区域
    ctx.save();
    ctx.beginPath();
    ctx.rect(
      headerWidth,
      headerHeight,
      ctx.canvas.width - headerWidth,
      ctx.canvas.height - headerHeight
    );
    ctx.clip();

    for (const user of this.remoteUsers.values()) {
      if (!user.selection) continue;

      const { startRow, startCol, endRow, endCol } = user.selection;

      // 计算选择区域与视口的交集
      const visibleStartRow = Math.max(startRow, viewport.startRow);
      const visibleEndRow = Math.min(endRow, viewport.endRow);
      const visibleStartCol = Math.max(startCol, viewport.startCol);
      const visibleEndCol = Math.min(endCol, viewport.endCol);

      // 如果选择区域不在视口内，跳过
      if (visibleEndRow < visibleStartRow || visibleEndCol < visibleStartCol) {
        continue;
      }

      // 计算选择区域的屏幕坐标
      const startX = headerWidth + model.getColX(visibleStartCol) - scrollX;
      const startY = headerHeight + model.getRowY(visibleStartRow) - scrollY;

      let width = 0;
      for (let col = visibleStartCol; col <= visibleEndCol; col++) {
        width += model.getColWidth(col);
      }

      let height = 0;
      for (let row = visibleStartRow; row <= visibleEndRow; row++) {
        height += model.getRowHeight(row);
      }

      // 绘制选择区域半透明背景
      const bgColor = this.hexToRgba(user.color, 0.08);
      ctx.fillStyle = bgColor;
      ctx.fillRect(startX, startY, width, height);

      // 绘制选择区域边框
      ctx.strokeStyle = user.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(startX, startY, width, height);

      // 绘制用户名称标签（在选择区域左上角上方）
      this.renderUserLabel(ctx, user.userName, user.color, startX, startY);
    }

    ctx.restore();
  }

  /**
   * 绘制用户名称标签
   */
  private renderUserLabel(
    ctx: CanvasRenderingContext2D,
    userName: string,
    color: string,
    x: number,
    y: number
  ): void {
    const labelFontSize = 11;
    const labelPadding = 4;
    const labelHeight = labelFontSize + labelPadding * 2;

    ctx.font = `${labelFontSize}px sans-serif`;
    const textWidth = ctx.measureText(userName).width;
    const labelWidth = textWidth + labelPadding * 2;

    // 标签位置：选择区域左上角上方
    const labelX = x;
    const labelY = y - labelHeight;

    // 绘制标签背景
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(labelX, labelY, labelWidth, labelHeight, 2);
    ctx.fill();

    // 绘制标签文字（白色）
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(userName, labelX + labelPadding, labelY + labelHeight / 2);
  }

  /**
   * 将十六进制颜色转换为 rgba 格式
   */
  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * 清理所有资源（定时器等）
   */
  public destroy(): void {
    for (const timer of this.removeTimers.values()) {
      clearTimeout(timer);
    }
    this.removeTimers.clear();
    this.remoteUsers.clear();
    this.usedColorIndices.clear();
    this.userColorMap.clear();
  }
}
