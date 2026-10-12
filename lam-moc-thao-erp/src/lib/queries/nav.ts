import { prisma } from '../db'
import type { SessionUser } from '../auth'
import { addDays, dateOnlyToInstant, todayVN } from '../rules/dates'
import { receivableScope } from '../permissions'
import type { Prisma } from '@prisma/client'

/** Điều kiện báo giá đang chờ người dùng duyệt */
export function quotesAwaiting(user: SessionUser): Prisma.QuoteWhereInput | null {
  if (user.role === 'GIAM_DOC') return { status: 'CHO_DUYET' }
  if (user.role === 'PGD_KINH_DOANH') return { status: 'CHO_DUYET', approvalLevel: 'PGD_KINH_DOANH' }
  return null
}

/** Điều kiện hợp đồng đang chờ người dùng xử lý (rà soát, đề xuất, phê duyệt) */
export function contractsAwaiting(user: SessionUser): Prisma.ContractWhereInput | null {
  const or: Prisma.ContractWhereInput[] = []
  if (user.role === 'KE_TOAN' || user.role === 'GIAM_DOC') or.push({ status: 'CHO_DUYET', reviewedAt: null })
  if (user.role === 'PGD_KINH_DOANH') or.push({ status: 'CHO_DUYET', reviewedAt: { not: null }, signerLevel: 'PGD_KINH_DOANH' })
  if (user.role === 'GIAM_DOC') {
    or.push({ status: 'CHO_DUYET', reviewedAt: { not: null }, signerLevel: { in: ['PGD_KINH_DOANH', 'GIAM_DOC'] } })
    or.push({ status: 'CHO_DUYET', reviewedAt: { not: null }, signerLevel: 'CHU_TICH', proposedAt: null })
  }
  if (user.isChairman) or.push({ status: 'CHO_DUYET', signerLevel: 'CHU_TICH', proposedAt: { not: null } })
  return or.length ? { OR: or } : null
}

export async function navCounts(user: SessionUser) {
  const endOfToday = dateOnlyToInstant(addDays(todayVN(), 1))
  const quoteWhere = quotesAwaiting(user)
  const contractWhere = contractsAwaiting(user)
  const [tasks, quotes, contracts, overdue] = await Promise.all([
    prisma.activity.count({ where: { assigneeId: user.id, doneAt: null, dueAt: { lt: endOfToday } } }),
    quoteWhere ? prisma.quote.count({ where: quoteWhere }) : 0,
    contractWhere ? prisma.contract.count({ where: contractWhere }) : 0,
    // Khoản quá hạn trên 30 ngày còn phải thu
    prisma.receivable
      .findMany({
        where: { AND: [receivableScope(user), { dueDate: { lt: addDays(todayVN(), -30) } }] },
        select: { amount: true, paidAmount: true },
      })
      .then((rows) => rows.filter((r) => r.amount - r.paidAmount > 0).length),
  ])
  return { tasks, quotes, contracts, overdue }
}
