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
  },
  webServer: {
    command: 'npx vite --port 3000',
    port: 3000,
    reuseExistingServer: true,
  },
});
