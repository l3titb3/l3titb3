import Link from 'next/link'
import type { Prisma, QuoteStatus } from '@prisma/client'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can, quoteScope } from '@/lib/permissions'
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Table, Td, Th } from '@/components/ui'
import { Input, Select } from '@/components/form'
import { QUOTE_STATUS_LABEL } from '@/lib/labels'
import { formatPercent, formatVnd } from '@/lib/rules/money'
import { formatDate, todayVN } from '@/lib/rules/dates'
import { quotesAwaiting } from '@/lib/queries/nav'
import { quoteStatusTone } from '@/lib/tones'

export const metadata = { title: 'Báo giá' }

export default async function QuotesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser()
  const sp = await searchParams
  const awaiting = quotesAwaiting(user)
  const filters: Prisma.QuoteWhereInput[] = [quoteScope(user)]
  if (sp.status === 'cho-toi-duyet' && awaiting) filters.push(awaiting)
  else if (sp.status) filters.push({ status: sp.status as QuoteStatus })
  if (sp.q) filters.push({ OR: [{ number: { contains: sp.q } }, { customer: { name: { contains: sp.q, mode: 'insensitive' } } }, { title: { contains: sp.q, mode: 'insensitive' } }] })
  const quotes = await prisma.quote.findMany({
    where: { AND: filters },
    orderBy: [{ year: 'desc' }, { seq: 'desc' }],
    take: 200,
    include: { customer: { select: { name: true } }, segment: { select: { name: true, floorMargin: true } }, createdBy: { select: { name: true } } },
  })
  const today = todayVN()
  const statusOptions = [
    ...(awaiting ? [{ value: 'cho-toi-duyet', label: 'Chờ tôi duyệt' }] : []),
    ...Object.entries(QUOTE_STATUS_LABEL).map(([value, label]) => ({ value, label })),
  ]

  return (
    <>
      <PageHeader title="Báo giá" description="Lập, trình duyệt, gửi khách, theo dõi kết quả báo giá (QT-KD-01 bước 4 - 6)." actions={can.sell(user) && <ButtonLink href="/bao-gia/moi">+ Lập báo giá</ButtonLink>} />
      <Card>
        <form method="get" className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_14rem_auto]">
          <Input name="q" defaultValue={sp.q} placeholder="Tìm theo số báo giá, khách hàng, tiêu đề" />
          <Select name="status" defaultValue={sp.status ?? ''} placeholder="Mọi trạng thái" options={statusOptions} />
          <button className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50">Lọc</button>
        </form>
        {quotes.length === 0 ? (
          <EmptyState title="Chưa có báo giá" />
        ) : (
          <Table>
            <thead>
              <tr><Th>Số</Th><Th>Khách hàng</Th><Th>Ngày, hiệu lực</Th><Th>Người lập</Th><Th className="text-right">Biên LN</Th><Th className="text-right">Tổng gồm VAT</Th><Th>Trạng thái</Th></tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const expired = ['DA_DUYET', 'DA_GUI'].includes(q.status) && q.validUntil < today
                const low = q.segment.floorMargin !== null && q.grossMargin < q.segment.floorMargin
                return (
                  <tr key={q.id} className="hover:bg-zinc-50">
                    <Td><Link href={`/bao-gia/${q.id}`} className="num whitespace-nowrap font-semibold hover:text-brand">{q.number}</Link></Td>
                    <Td>{q.customer.name}<div className="text-xs text-muted">{q.title ?? q.segment.name}</div></Td>
                    <Td className="whitespace-nowrap">{formatDate(q.quoteDate)}<div className="text-xs text-muted">đến {formatDate(q.validUntil)}</div></Td>
                    <Td>{q.createdBy.name}</Td>
                    <Td className={`num text-right ${low ? 'font-semibold text-red-700' : ''}`}>{formatPercent(q.grossMargin)}</Td>
                    <Td className="num text-right">{formatVnd(q.total)}</Td>
                    <Td>
                      <Badge tone={quoteStatusTone(q.status)}>{QUOTE_STATUS_LABEL[q.status]}</Badge>
                      {expired && <div className="mt-1"><Badge tone="orange">Hết hiệu lực</Badge></div>}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  )
}
