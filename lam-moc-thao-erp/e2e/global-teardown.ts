import { execSync } from 'node:child_process'

/** Xóa cơ sở dữ liệu do chính lần chạy kiểm thử này tạo ra */
export default function globalTeardown() {
  const name = process.env.E2E_DB_NAME
  if (!name || !/^lmt_e2e_\d+$/.test(name) || process.env.E2E_KEEP_DB) return
  execSync(`psql "${process.env.E2E_ADMIN_URL}" -c "DROP DATABASE IF EXISTS ${name} WITH (FORCE)"`, { stdio: 'inherit' })
}
