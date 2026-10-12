import { execSync } from 'node:child_process'

/** Tạo cơ sở dữ liệu kiểm thử mới, áp dụng migration, khởi tạo 05 tài khoản */
export default function globalSetup() {
  const name = process.env.E2E_DB_NAME!
  if (!/^lmt_e2e_\d+$/.test(name)) throw new Error(`Tên cơ sở dữ liệu kiểm thử không hợp lệ: ${name}`)
  execSync(`psql "${process.env.E2E_ADMIN_URL}" -c "CREATE DATABASE ${name}"`, { stdio: 'inherit' })
  const env = { ...process.env, DATABASE_URL: process.env.E2E_DATABASE_URL, SEED_PASSWORD: 'Kiem-thu-2026' }
  execSync('npx prisma migrate deploy', { env, stdio: 'inherit' })
  execSync('npx tsx prisma/seed.ts', { env, stdio: 'inherit' })
}
