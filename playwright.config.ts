import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  reporter: [['list'], ['json', { outputFile: 'pw-report.json' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'off',
  },
  webServer: {
    command: 'pnpm dev',
    url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000,
    env: { ...process.env, LLM_FAKE: '1', NODE_ENV: 'test' },
  },
})


