// ============================================================
// ICE Excel 企业版 - 审计日志服务
// ============================================================

import { AuditLogEntry, AuditLogQuery, AuditLogResult, AuditEventType, AuditEventCategory } from './types';

/** 事件类型到分类的映射 */
const EVENT_CATEGORY_MAP: Record<AuditEventType, AuditEventCategory> = {
  LOGIN: 'auth', LOGIN_FAILED: 'auth', LOGOUT: 'auth',
  TOKEN_REFRESH: 'auth', PASSWORD_CHANGE: 'auth', SSO_ASSERTION: 'auth',
  PERMISSION_GRANT: 'permission', PERMISSION_REVOKE: 'permission',
  ROLE_CHANGE: 'permission', SHARE_CREATED: 'permission', SHARE_REVOKED: 'permission',
  CELL_EDIT: 'data', CELL_PROTECT: 'data', SHEET_LOCK: 'data',
  SHEET_UNLOCK: 'data', BULK_UPDATE: 'data', DATA_EXPORTED: 'data',
  USER_INVITED: 'admin', USER_REMOVED: 'admin',
  POLICY_CHANGED: 'admin', WORKBOOK_CREATED: 'admin',
};

/** 审计日志服务 */
export class AuditService {
  private readonly API_BASE: string;
  private localBuffer: AuditLogEntry[] = [];
  private getAuthHeaders: () => Record<string, string>;

  constructor(apiBase: string, getAuthHeaders: () => Record<string, string>) {
    this.API_BASE = apiBase;
    this.getAuthHeaders = getAuthHeaders;
  }

  /** 记录审计事件 */
  async log(
    eventType: AuditEventType,
    userId: string,
    userName: string,
    target: string,
    detail: string,
  ): Promise<void> {
    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      userId,
      userName,
      eventType,
      category: EVENT_CATEGORY_MAP[eventType],
      target,
      detail,
      ip: '', // 由服务端填充
    };

    // 先缓存到本地
    this.localBuffer.push(entry);

    // 异步发送到服务端
    try {
      await fetch(`${this.API_BASE}/audit/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify(entry),
      });
    } catch {
      // 发送失败时保留在本地缓冲区，后续重试
    }
  }

  /** 查询审计日志 */
  async query(params: AuditLogQuery): Promise<AuditLogResult> {
    try {
      const queryStr = new URLSearchParams();
      if (params.category) queryStr.set('category', params.category);
      if (params.userId) queryStr.set('userId', params.userId);
      if (params.startTime) queryStr.set('startTime', params.startTime.toString());
      if (params.endTime) queryStr.set('endTime', params.endTime.toString());
      queryStr.set('page', params.page.toString());
      queryStr.set('pageSize', params.pageSize.toString());

      const response = await fetch(`${this.API_BASE}/audit/logs?${queryStr}`, {
        headers: this.getAuthHeaders(),
      });

      if (response.ok) {
        return await response.json() as AuditLogResult;
      }
    } catch {
      // 网络错误时返回本地缓冲区数据
    }

    // 降级：返回本地缓冲区
    let filtered = [...this.localBuffer];
    if (params.category) {
      filtered = filtered.filter(e => e.category === params.category);
    }
    const start = params.page * params.pageSize;
    return {
      entries: filtered.slice(start, start + params.pageSize),
      total: filtered.length,
      page: params.page,
      pageSize: params.pageSize,
    };
  }

  /** 导出审计日志为 CSV */
  async exportCSV(params: AuditLogQuery): Promise<string> {
    const result = await this.query({ ...params, page: 0, pageSize: 10000 });
    const header = '时间,用户,操作类型,分类,目标,详情,IP';
    const rows = result.entries.map(e => {
      const time = new Date(e.timestamp).toLocaleString('zh-CN');
      return `${time},${e.userName},${e.eventType},${e.category},${e.target},${e.detail},${e.ip}`;
    });
    return [header, ...rows].join('\n');
  }

  /** 导出审计日志为 JSON */
  async exportJSON(params: AuditLogQuery): Promise<string> {
    const result = await this.query({ ...params, page: 0, pageSize: 10000 });
    return JSON.stringify(result.entries, null, 2);
  }

  /** 获取本地缓冲区大小 */
  getBufferSize(): number {
    return this.localBuffer.length;
  }
}
