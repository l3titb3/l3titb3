import Link from 'next/link'
import type { OpportunityStage, Prisma } from '@prisma/client'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can, opportunityScope } from '@/lib/permissions'
import { Badge, ButtonLink, PageHeader } from '@/components/ui'
import { Select } from '@/components/form'
import { OPPORTUNITY_STAGES, STAGE_LABEL } from '@/lib/labels'
import { formatVnd, formatVndShort } from '@/lib/rules/money'
import { formatInstantDate, startOfYear, todayVN, dateOnlyToInstant } from '@/lib/rules/dates'
import { opportunitySla } from '@/lib/sla'
import { salesPeople } from '@/lib/queries/access'

export const metadata = { title: 'Cơ hội bán hàng' }

const OPEN: OpportunityStage[] = ['TIEP_NHAN', 'KHAO_SAT', 'BAO_GIA', 'DAM_PHAN']

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser()
  const sp = await searchParams
  const stageFilter = sp['giai-doan'] as OpportunityStage | undefined
  const filters: Prisma.OpportunityWhereInput[] = [opportunityScope(user)]
  if (sp.owner) filters.push({ ownerId: sp.owner })
  if (sp.segment) filters.push({ segmentId: sp.segment })
  const yearStart = dateOnlyToInstant(startOfYear(todayVN()))

  const [open, closed, owners, segments] = await Promise.all([
    prisma.opportunity.findMany({
      where: { AND: [...filters, { stage: { in: stageFilter && OPEN.includes(stageFilter) ? [stageFilter] : OPEN } }] },
      orderBy: { receivedAt: 'desc' },
      include: { customer: { select: { name: true } }, owner: { select: { name: true } }, segment: { select: { name: true } }, survey: { select: { surveyDate: true } }, _count: { select: { quotes: true } } },
    }),
    prisma.opportunity.findMany({
      where: { AND: [...filters, { stage: { in: ['THANG', 'THUA'] }, closedAt: { gte: yearStart } }] },
      orderBy: { closedAt: 'desc' },
      take: 30,
      include: { customer: { select: { name: true } } },
    }),
    salesPeople(),
    prisma.segment.findMany({ orderBy: { sortOrder: 'asc' } }),
  ])
  const now = new Date()
  const columns = stageFilter && OPEN.includes(stageFilter) ? [stageFilter] : OPEN

  return (
    <>
      <PageHeader
        title="Cơ hội bán hàng"
        description="Theo QT-KD-01: phản hồi trong 15 phút giờ hành chính, khảo sát và báo giá trong 02 ngày làm việc."
        actions={can.sell(user) && <ButtonLink href="/co-hoi/moi">+ Tiếp nhận nhu cầu</ButtonLink>}
      />
      <form method="get" className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-[14rem_16rem_auto_auto] sm:justify-start">
        <Select name="owner" defaultValue={sp.owner ?? ''} placeholder="Mọi người phụ trách" options={owners.map((o) => ({ value: o.id, label: o.name }))} />
        <Select name="segment" defaultValue={sp.segment ?? ''} placeholder="Mọi mảng kinh doanh" options={segments.map((s) => ({ value: s.id, label: s.name }))} />
        <button className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50">Lọc</button>
        {(stageFilter || sp.owner || sp.segment) && (
          <Link href="/co-hoi" className="self-center text-sm text-brand hover:underline">Bỏ lọc</Link>
        )}
      </form>

      <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${columns.length > 1 ? 'xl:grid-cols-4' : ''}`}>
        {columns.map((stage) => {
          const items = open.filter((o) => o.stage === stage)
          const total = items.reduce((s, o) => s + o.expectedValue, 0)
          return (
            <section key={stage} className="flex flex-col rounded-2xl border border-line bg-zinc-50/70">
              <header className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="text-sm font-bold">
                  {STAGE_LABEL[stage]} <span className="font-normal text-muted">({items.length})</span>
                </h2>
                <span className="num text-xs text-muted">{formatVndShort(total)}</span>
              </header>
              <div className="flex-1 space-y-3 p-3">
                {items.length === 0 && <p className="px-1 py-4 text-center text-xs text-muted">Trống</p>}
                {items.map((o) => {
                  const flags = opportunitySla({ ...o, quoteCount: o._count.quotes }, now)
                  return (
                    <Link key={o.id} href={`/co-hoi/${o.id}`} className="block rounded-xl border border-line bg-white p-3 transition hover:border-brand/40 hover:shadow-sm">
                      <div className="text-sm font-semibold leading-snug text-ink">{o.title}</div>
                      <div className="mt-1 text-xs text-muted">{o.customer.name}</div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-muted">{o.owner?.name ?? <span className="text-gap">Chưa giao</span>}</span>
                        <span className="num font-semibold">{formatVnd(o.expectedValue)}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-muted">{o.segment.name} · Nhận {formatInstantDate(o.receivedAt)}</div>
                      {flags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {flags.map((f) => <Badge key={f.label} tone={f.tone}>{f.label}</Badge>)}
                        </div>
                      )}
                    </Link>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-bold">Đã đóng trong năm</h2>
        {closed.length === 0 ? (
          <p className="text-sm text-muted">Chưa có cơ hội đóng trong năm.</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
            {closed.map((o) => (
              <li key={o.id}>
                <Link href={`/co-hoi/${o.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm hover:bg-zinc-50">
                  <Badge tone={o.stage === 'THANG' ? 'green' : 'gray'}>{STAGE_LABEL[o.stage]}</Badge>
                  <span className="flex-1 font-medium">{o.title} · <span className="text-muted">{o.customer.name}</span></span>
                  {o.lostReason && <span className="text-xs text-muted">Lý do: {o.lostReason}</span>}
                  <span className="num text-xs text-muted">{formatVnd(o.expectedValue)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="mt-6 text-xs text-muted">Giai đoạn: {OPPORTUNITY_STAGES.map((s) => STAGE_LABEL[s]).join(' → ')}.</p>
    </>
  )
}
