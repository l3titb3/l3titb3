import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'

const PORT = 3100
// Mỗi lần chạy dùng một cơ sở dữ liệu mới, không đụng tới dữ liệu đang có
process.env.E2E_DB_NAME ??= `lmt_e2e_${Date.now()}`
const server = process.env.E2E_PG_SERVER ?? 'postgresql://postgres@localhost:5432'
const query = process.env.E2E_PG_QUERY ?? '?host=/tmp'
process.env.E2E_DATABASE_URL = `${server}/${process.env.E2E_DB_NAME}${query}`
process.env.E2E_ADMIN_URL = `${server}/postgres${query}`
const chromium = process.env.PLAYWRIGHT_CHROMIUM ?? '/opt/pw-browsers/chromium'

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  workers: 1,
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    launchOptions: existsSync(chromium) ? { executablePath: chromium } : {},
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/dang-nhap`,
    reuseExistingServer: false,
    env: { DATABASE_URL: process.env.E2E_DATABASE_URL, COOKIE_SECURE: 'false' },
    timeout: 60_000,
  },
})
