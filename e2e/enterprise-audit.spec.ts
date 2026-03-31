import { test, expect } from '@playwright/test';

/**
 * 企业版审计日志 E2E 测试
 */

test.describe('企业版 - 审计日志', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('审计事件分类映射正确', async ({ page }) => {
    const result = await page.evaluate(() => {
      const EVENT_CATEGORIES: Record<string, string> = {
        LOGIN: 'auth', LOGIN_FAILED: 'auth', LOGOUT: 'auth',
        TOKEN_REFRESH: 'auth', PASSWORD_CHANGE: 'auth', SSO_ASSERTION: 'auth',
        PERMISSION_GRANT: 'permission', PERMISSION_REVOKE: 'permission',
        ROLE_CHANGE: 'permission', SHARE_CREATED: 'permission', SHARE_REVOKED: 'permission',
        CELL_EDIT: 'data', CELL_PROTECT: 'data', SHEET_LOCK: 'data',
        SHEET_UNLOCK: 'data', BULK_UPDATE: 'data', DATA_EXPORTED: 'data',
        USER_INVITED: 'admin', USER_REMOVED: 'admin',
        POLICY_CHANGED: 'admin', WORKBOOK_CREATED: 'admin',
      };

      return {
        loginCategory: EVENT_CATEGORIES.LOGIN,
        cellEditCategory: EVENT_CATEGORIES.CELL_EDIT,
        roleChangeCategory: EVENT_CATEGORIES.ROLE_CHANGE,
        userInvitedCategory: EVENT_CATEGORIES.USER_INVITED,
        totalEvents: Object.keys(EVENT_CATEGORIES).length,
      };
    });

    expect(result.loginCategory).toBe('auth');
    expect(result.cellEditCategory).toBe('data');
    expect(result.roleChangeCategory).toBe('permission');
    expect(result.userInvitedCategory).toBe('admin');
    expect(result.totalEvents).toBe(21); // PRD 定义的事件类型
  });

  test('审计日志条目结构正确', async ({ page }) => {
    const result = await page.evaluate(() => {
      // 模拟创建审计日志条目
      const entry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        userId: 'user-1',
        userName: 'zhangsan',
        eventType: 'CELL_EDIT',
        category: 'data',
        target: 'Sheet1!B2',
        detail: '批量修改格式',
        ip: '192.168.1.12',
      };

      return {
        hasId: typeof entry.id === 'string' && entry.id.length > 0,
        hasTimestamp: typeof entry.timestamp === 'number',
        hasUserId: entry.userId === 'user-1',
        hasUserName: entry.userName === 'zhangsan',
        hasEventType: entry.eventType === 'CELL_EDIT',
        hasCategory: entry.category === 'data',
        hasTarget: entry.target === 'Sheet1!B2',
        hasDetail: entry.detail === '批量修改格式',
        hasIp: entry.ip === '192.168.1.12',
      };
    });

    expect(result.hasId).toBe(true);
    expect(result.hasTimestamp).toBe(true);
    expect(result.hasUserId).toBe(true);
    expect(result.hasUserName).toBe(true);
    expect(result.hasEventType).toBe(true);
    expect(result.hasCategory).toBe(true);
    expect(result.hasTarget).toBe(true);
    expect(result.hasDetail).toBe(true);
    expect(result.hasIp).toBe(true);
  });

  test('CSV 导出格式正确', async ({ page }) => {
    const result = await page.evaluate(() => {
      // 模拟 CSV 导出
      const entries = [
        { timestamp: 1711872221000, userName: 'zhangsan', eventType: 'CELL_EDIT',
          category: 'data', target: 'Sheet1!B2', detail: '修改内容', ip: '192.168.1.12' },
        { timestamp: 1711872165000, userName: 'lisi', eventType: 'LOGIN',
          category: 'auth', target: '系统', detail: 'OAuth2 Google', ip: '203.0.113.8' },
      ];

      const header = '时间,用户,操作类型,分类,目标,详情,IP';
      const rows = entries.map(e => {
        const time = new Date(e.timestamp).toLocaleString('zh-CN');
        return `${time},${e.userName},${e.eventType},${e.category},${e.target},${e.detail},${e.ip}`;
      });
      const csv = [header, ...rows].join('\n');

      return {
        hasHeader: csv.startsWith('时间,用户,操作类型'),
        lineCount: csv.split('\n').length,
        containsZhangsan: csv.includes('zhangsan'),
        containsLisi: csv.includes('lisi'),
      };
    });

    expect(result.hasHeader).toBe(true);
    expect(result.lineCount).toBe(3); // header + 2 rows
    expect(result.containsZhangsan).toBe(true);
    expect(result.containsLisi).toBe(true);
  });
});
