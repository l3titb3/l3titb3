import { cache } from 'react'
import { prisma } from './db'

export const getCompany = cache(async () => {
  const company = await prisma.companySetting.findUnique({ where: { id: 1 } })
  if (!company) throw new Error('Chưa khởi tạo thông tin công ty. Chạy: npm run db:seed')
  return company
})
