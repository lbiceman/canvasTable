import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [],
  server: {
    port: 3000,
    host: '0.0.0.0',
    open: true
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  }
})