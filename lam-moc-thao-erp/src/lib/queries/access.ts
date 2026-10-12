import { notFound } from 'next/navigation'
import { prisma } from '../db'
import type { SessionUser } from '../auth'
import { contractScope, customerScope, opportunityScope, quoteScope } from '../permissions'

/** Lấy bản ghi trong phạm vi người dùng được xem; ngoài phạm vi trả về 404 */
export async function visibleCustomer(user: SessionUser, id: string) {
  const c = await prisma.customer.findFirst({ where: { AND: [{ id }, customerScope(user)] } })
  if (!c) notFound()
  return c
}

export async function visibleOpportunity(user: SessionUser, id: string) {
  const o = await prisma.opportunity.findFirst({ where: { AND: [{ id }, opportunityScope(user)] } })
  if (!o) notFound()
  return o
}

export async function visibleQuote(user: SessionUser, id: string) {
  const q = await prisma.quote.findFirst({ where: { AND: [{ id }, quoteScope(user)] } })
  if (!q) notFound()
  return q
}

export async function visibleContract(user: SessionUser, id: string) {
  const c = await prisma.contract.findFirst({ where: { AND: [{ id }, contractScope(user)] } })
  if (!c) notFound()
  return c
}

/** Người dùng có thể giao phụ trách khách hàng, cơ hội (khối kinh doanh và Ban Giám đốc) */
export async function salesPeople() {
  return prisma.user.findMany({
    where: { active: true, role: { in: ['GIAM_DOC', 'PGD_KINH_DOANH', 'NV_KINH_DOANH'] } },
    select: { id: true, name: true, title: true },
    orderBy: { name: 'asc' },
  })
}

export async function activeUsers() {
  return prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, title: true, role: true }, orderBy: { name: 'asc' } })
}

/** Công nợ còn phải thu của khách hàng, có cờ tạm dừng giao hàng */
export async function customerDebt(customerId: string) {
  const rows = await prisma.receivable.findMany({ where: { customerId }, select: { amount: true, paidAmount: true, dueDate: true } })
  return rows
}

export async function distinctAreas() {
  const rows = await prisma.customer.findMany({ where: { area: { not: null } }, distinct: ['area'], select: { area: true } })
  return rows.map((r) => r.area).filter((a): a is string => !!a)
}
