// Playwright end-to-end test config. The app is static: a Python http.server
// is enough as the web server (WASM needs real HTTP, file:// won't work).
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 120000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:8123',
    // CHROMIUM_PATH: use a pre-installed browser instead of the downloaded one
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
  },
  webServer: {
    command: 'python3 -m http.server 8123 --bind 127.0.0.1',
    url: 'http://127.0.0.1:8123',
    reuseExistingServer: !process.env.CI
  }
});
