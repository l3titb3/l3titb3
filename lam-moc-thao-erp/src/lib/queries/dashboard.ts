import type { ContractStatus } from '@prisma/client'
import { prisma } from '../db'
import type { SessionUser } from '../auth'
import { contractScope, customerScope, opportunityScope, quoteScope, receivableScope } from '../permissions'
import { addDays, dateOnlyToInstant, startOfMonth, startOfYear, todayVN } from '../rules/dates'
import { outstanding, summarizeAging } from '../rules/aging'
import { OPPORTUNITY_STAGES } from '../labels'
import { contractsAwaiting, quotesAwaiting } from './nav'
import { DEBT_REMINDER_DAYS, RENEWAL_NOTICE_DAYS } from '../rules/followups'

export const SIGNED_STATUSES: ContractStatus[] = ['DA_KY', 'HOAN_THANH', 'THANH_LY']

export async function getDashboard(user: SessionUser) {
  const today = todayVN()
  const monthStart = startOfMonth(today)
  const yearStart = startOfYear(today)
  const sixMonthsStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5, 1))
  const endOfToday = dateOnlyToInstant(addDays(today, 1))

  const rScope = receivableScope(user)
  const cScope = contractScope(user)
  const quoteWhere = quotesAwaiting(user)
  const contractWhere = contractsAwaiting(user)

  const [payments, contractsYtd, openOpps, quotesClosed, receivables, customers, myTasks, pendingQuotes, pendingContracts, expiringQuotes, endingContracts, newLeads, wonQuotes] =
    await Promise.all([
      prisma.payment.findMany({ where: { date: { gte: sixMonthsStart }, receivable: rScope }, select: { date: true, amount: true } }),
      prisma.contract.findMany({
        where: { AND: [cScope, { status: { in: SIGNED_STATUSES }, signDate: { gte: yearStart } }] },
        select: { signDate: true, value: true, total: true, segment: { select: { name: true } }, owner: { select: { name: true } } },
      }),
      prisma.opportunity.findMany({
        where: { AND: [opportunityScope(user), { stage: { notIn: ['THANG', 'THUA'] } }] },
        select: { stage: true, expectedValue: true },
      }),
      prisma.quote.groupBy({
        by: ['status'],
        where: { AND: [quoteScope(user), { status: { in: ['THANG', 'THUA'] }, closedAt: { gte: dateOnlyToInstant(yearStart) } }] },
        _count: true,
      }),
      prisma.receivable.findMany({ where: rScope, select: { amount: true, paidAmount: true, dueDate: true } }),
      prisma.customer.findMany({
        where: customerScope(user),
        select: { type: true, ownerId: true, industry: true, source: true, taxCode: true, contactPhone: true, status: true },
      }),
      prisma.activity.findMany({
        where: { assigneeId: user.id, doneAt: null, dueAt: { lt: endOfToday } },
        orderBy: { dueAt: 'asc' },
        take: 8,
        include: { customer: { select: { id: true, name: true } } },
      }),
      quoteWhere ? prisma.quote.findMany({ where: quoteWhere, take: 6, orderBy: { submittedAt: 'asc' }, include: { customer: { select: { name: true } } } }) : [],
      contractWhere ? prisma.contract.findMany({ where: contractWhere, take: 6, orderBy: { updatedAt: 'asc' }, include: { customer: { select: { name: true } } } }) : [],
      prisma.quote.findMany({
        where: { AND: [quoteScope(user), { status: { in: ['DA_DUYET', 'DA_GUI'] }, validUntil: { gte: today, lte: addDays(today, 3) } }] },
        include: { customer: { select: { name: true } } },
        take: 6,
      }),
      prisma.contract.findMany({
        where: { AND: [cScope, { status: 'DA_KY', endDate: { not: null, lte: addDays(today, RENEWAL_NOTICE_DAYS) } }] },
        include: { customer: { select: { name: true } } },
        orderBy: { endDate: 'asc' },
        take: 6,
      }),
      prisma.opportunity.findMany({
        where: { AND: [opportunityScope(user), { firstContactAt: null, stage: 'TIEP_NHAN' }] },
        include: { customer: { select: { name: true } } },
        take: 6,
      }),
      prisma.quote.findMany({
        where: { AND: [quoteScope(user), { status: 'THANG', closedAt: { gte: dateOnlyToInstant(yearStart) } }] },
        select: { subtotal: true, costTotal: true },
      }),
    ])

  const cashThisMonth = payments.filter((p) => p.date >= monthStart).reduce((s, p) => s + p.amount, 0)
  const contractsThisMonth = contractsYtd.filter((c) => c.signDate && c.signDate >= monthStart)

  const months: Array<{ key: string; label: string; value: number }> = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(Date.UTC(sixMonthsStart.getUTCFullYear(), sixMonthsStart.getUTCMonth() + i, 1))
    months.push({ key: d.toISOString().slice(0, 7), label: `T${d.getUTCMonth() + 1}`, value: 0 })
  }
  for (const p of payments) {
    const m = months.find((x) => x.key === p.date.toISOString().slice(0, 7))
    if (m) m.value += p.amount
  }

  const funnel = OPPORTUNITY_STAGES.filter((s) => s !== 'THANG' && s !== 'THUA').map((stage) => {
    const items = openOpps.filter((o) => o.stage === stage)
    return { stage, count: items.length, value: items.reduce((s, o) => s + o.expectedValue, 0) }
  })

  const won = quotesClosed.find((q) => q.status === 'THANG')?._count ?? 0
  const lost = quotesClosed.find((q) => q.status === 'THUA')?._count ?? 0
  const wonRevenue = wonQuotes.reduce((s, q) => s + q.subtotal, 0)
  const wonCost = wonQuotes.reduce((s, q) => s + q.costTotal, 0)

  const group = (key: (c: (typeof contractsYtd)[number]) => string) => {
    const map = new Map<string, number>()
    for (const c of contractsYtd) map.set(key(c), (map.get(key(c)) ?? 0) + c.value)
    return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  }

  const dueSoon = receivables.filter((r) => outstanding(r) > 0 && r.dueDate >= today && r.dueDate <= addDays(today, DEBT_REMINDER_DAYS)).length

  return {
    today,
    cashThisMonth,
    contractsThisMonth: { count: contractsThisMonth.length, total: contractsThisMonth.reduce((s, c) => s + c.total, 0) },
    pipeline: { count: openOpps.length, value: openOpps.reduce((s, o) => s + o.expectedValue, 0), funnel },
    conversion: { won, lost, rate: won + lost > 0 ? Math.round((won / (won + lost)) * 1000) / 10 : null },
    wonMargin: wonRevenue > 0 ? Math.round(((wonRevenue - wonCost) / wonRevenue) * 1000) / 10 : null,
    aging: summarizeAging(receivables, today),
    dueSoon,
    months,
    bySegment: group((c) => c.segment.name),
    byOwner: group((c) => c.owner?.name ?? 'Chưa giao người phụ trách'),
    dataQuality: {
      total: customers.length,
      noOwner: customers.filter((c) => !c.ownerId).length,
      noIndustry: customers.filter((c) => !c.industry).length,
      noSource: customers.filter((c) => !c.source).length,
      noPhone: customers.filter((c) => !c.contactPhone).length,
      orgNoTax: customers.filter((c) => c.type === 'TO_CHUC' && !c.taxCode).length,
      orgs: customers.filter((c) => c.type === 'TO_CHUC').length,
      byStatus: {
        TIEM_NANG: customers.filter((c) => c.status === 'TIEM_NANG').length,
        DANG_GIAO_DICH: customers.filter((c) => c.status === 'DANG_GIAO_DICH').length,
        NGUNG: customers.filter((c) => c.status === 'NGUNG').length,
      },
    },
    todo: { myTasks, pendingQuotes, pendingContracts, expiringQuotes, endingContracts, newLeads },
  }
}
