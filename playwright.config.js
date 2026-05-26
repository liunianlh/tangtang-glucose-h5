import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    ...devices['Pixel 5'],
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  webServer: [
    {
      command: 'npm run api:dev',
      url: 'http://127.0.0.1:3001/api/health',
      reuseExistingServer: true,
      timeout: 20_000
    },
    {
      command: 'npm run dev -- --port 5173',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: true,
      timeout: 20_000
    }
  ]
});
