import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: [
    'e2e/**/*.spec.ts',
    'src/collaboration/__tests__/**/*.spec.ts'
  ],
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    headless: false,
    // 复用同一个浏览器上下文，页面在测试之间不关闭
    launchOptions: {
      slowMo: 0,
    },
  },
  workers: 1,
  // 关键：保持浏览器在测试之间不关闭
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        // 视频和 trace 关闭以减少开销
        video: 'off',
        trace: 'off',
      },
    },
  ],
  webServer: {
    command: 'npx vite --port 3000',
    port: 3000,
    reuseExistingServer: true,
  },
});
