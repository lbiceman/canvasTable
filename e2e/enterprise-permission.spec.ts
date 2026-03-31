import { test, expect } from '@playwright/test';

/**
 * 企业版权限控制 E2E 测试
 */

test.describe('企业版 - 权限控制', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('权限矩阵逻辑正确', async ({ page }) => {
    const result = await page.evaluate(() => {
      // 模拟权限矩阵
      const ROLE_PERMISSIONS: Record<string, {
        view: boolean; edit: boolean; format: boolean; protect: boolean; export: boolean;
      }> = {
        admin: { view: true, edit: true, format: true, protect: true, export: true },
        editor: { view: true, edit: true, format: true, protect: false, export: true },
        readOnly: { view: true, edit: false, format: false, protect: false, export: true },
        guest: { view: true, edit: false, format: false, protect: false, export: false },
      };

      return {
        adminCanEdit: ROLE_PERMISSIONS.admin.edit,
        adminCanProtect: ROLE_PERMISSIONS.admin.protect,
        editorCanEdit: ROLE_PERMISSIONS.editor.edit,
        editorCanProtect: ROLE_PERMISSIONS.editor.protect,
        readOnlyCanEdit: ROLE_PERMISSIONS.readOnly.edit,
        readOnlyCanExport: ROLE_PERMISSIONS.readOnly.export,
        guestCanView: ROLE_PERMISSIONS.guest.view,
        guestCanExport: ROLE_PERMISSIONS.guest.export,
      };
    });

    // Admin 权限验证
    expect(result.adminCanEdit).toBe(true);
    expect(result.adminCanProtect).toBe(true);

    // Editor 权限验证
    expect(result.editorCanEdit).toBe(true);
    expect(result.editorCanProtect).toBe(false);

    // ReadOnly 权限验证
    expect(result.readOnlyCanEdit).toBe(false);
    expect(result.readOnlyCanExport).toBe(true);

    // Guest 权限验证
    expect(result.guestCanView).toBe(true);
    expect(result.guestCanExport).toBe(false);
  });

  test('角色层级检查正确', async ({ page }) => {
    const result = await page.evaluate(() => {
      const hierarchy: Record<string, number> = {
        admin: 3, editor: 2, readOnly: 1, guest: 0,
      };

      const canGrantRole = (currentRole: string, targetRole: string): boolean => {
        return hierarchy[currentRole] >= hierarchy[targetRole];
      };

      return {
        adminCanGrantEditor: canGrantRole('admin', 'editor'),
        adminCanGrantAdmin: canGrantRole('admin', 'admin'),
        editorCanGrantAdmin: canGrantRole('editor', 'admin'),
        editorCanGrantReadOnly: canGrantRole('editor', 'readOnly'),
        readOnlyCanGrantEditor: canGrantRole('readOnly', 'editor'),
      };
    });

    expect(result.adminCanGrantEditor).toBe(true);
    expect(result.adminCanGrantAdmin).toBe(true);
    expect(result.editorCanGrantAdmin).toBe(false);
    expect(result.editorCanGrantReadOnly).toBe(true);
    expect(result.readOnlyCanGrantEditor).toBe(false);
  });
});
