import { prisma } from '../db'
import type { SessionUser } from '../auth'
import { customerScope, opportunityScope } from '../permissions'
import { getCompany } from '../settings'
import { VAT_RATES } from '../labels'

export async function quoteEditorOptions(user: SessionUser) {
  const [company, customers, opportunities, segments, products] = await Promise.all([
    getCompany(),
    prisma.customer.findMany({ where: { AND: [customerScope(user), { status: { not: 'NGUNG' } }] }, orderBy: { name: 'asc' }, select: { id: true, name: true, code: true } }),
    prisma.opportunity.findMany({ where: { AND: [opportunityScope(user), { stage: { notIn: ['THANG', 'THUA'] } }] }, select: { id: true, code: true, title: true, customerId: true, segmentId: true } }),
    prisma.segment.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.product.findMany({ where: { active: true }, orderBy: { code: 'asc' }, select: { id: true, code: true, name: true, spec: true, unit: true, listPrice: true, costPrice: true } }),
  ])
  return {
    company,
    customers: customers.map((c) => ({ id: c.id, label: `${c.name} (${c.code})` })),
    opportunities: opportunities.map((o) => ({ id: o.id, label: `${o.code} · ${o.title}`, customerId: o.customerId, segmentId: o.segmentId })),
    segments: segments.map((s) => ({ id: s.id, name: s.name, floorMargin: s.floorMargin, targetMarginMin: s.targetMarginMin, targetMarginMax: s.targetMarginMax })),
    products,
    vatRates: VAT_RATES,
  }
}
