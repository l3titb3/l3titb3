import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can, receivableScope } from '@/lib/permissions'
import { getCompany } from '@/lib/settings'
import { Badge, BarList, ButtonLink, Card, PageHeader, RuleBadge, Stat, Table, Td, Th } from '@/components/ui'
import { Select } from '@/components/form'
import { AGING_ACTION, AGING_LABEL, agingBucket, daysOverdue, outstanding, summarizeAging, type AgingBucket } from '@/lib/rules/aging'
import { formatPercent, formatVnd, formatVndShort } from '@/lib/rules/money'
import { addDays, formatDate, todayVN } from '@/lib/rules/dates'
import { salesPeople } from '@/lib/queries/access'

export const metadata = { title: 'Công nợ phải thu' }

const BUCKETS: Exclude<AgingBucket, 'DA_THU_DU'>[] = ['TRONG_HAN', 'QH_1_30', 'QH_31_60', 'QH_61_90', 'QH_TREN_90']

export default async function ReceivablesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser()
  const sp = await searchParams
  const today = todayVN()
  const filters: Prisma.ReceivableWhereInput[] = [receivableScope(user)]
  if (sp.owner) filters.push({ ownerId: sp.owner })
  const [company, rows, owners] = await Promise.all([
    getCompany(),
    prisma.receivable.findMany({
      where: { AND: filters },
      orderBy: { dueDate: 'asc' },
      include: { customer: { select: { id: true, name: true } }, contract: { select: { id: true, number: true, projectCode: true } }, owner: { select: { name: true } } },
    }),
    salesPeople(),
  ])
  const summary = summarizeAging(rows, today)
  const bucket = sp.nhom as AgingBucket | undefined
  const visible = rows.filter((r) => {
    const b = agingBucket(r, today)
    if (bucket) return b === bucket
    return sp.da_thu === '1' ? true : b !== 'DA_THU_DU'
  })
  const sorted = [...visible].sort((a, b) => daysOverdue(b.dueDate, today) - daysOverdue(a.dueDate, today))
  const dueSoon = rows.filter((r) => outstanding(r) > 0 && r.dueDate >= today && r.dueDate <= addDays(today, 3)).length

  return (
    <>
      <PageHeader
        title="Công nợ phải thu"
        description="Mỗi hóa đơn, đợt thanh toán một dòng. Tuổi nợ và biện pháp theo Điều 7 Quy chế quản lý tài chính."
        actions={can.manageReceivables(user) && <ButtonLink href="/cong-no/moi">+ Ghi công nợ</ButtonLink>}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Tổng còn phải thu" value={formatVndShort(summary.totalOutstanding)} hint={`Đến ngày ${formatDate(today)}`} />
        <Stat label="Quá hạn trên 30 ngày" value={formatVndShort(summary.over30)} tone={summary.over30 > 0 ? 'bad' : 'good'} hint="Tạm dừng giao hàng mới" />
        <Stat label="Tỷ lệ nợ quá hạn trên 30 ngày" value={formatPercent(summary.over30Ratio)} tone={summary.over30Ratio > company.overdueRatioLimit ? 'bad' : 'good'} hint={`Ngưỡng ${company.overdueRatioLimit}% (Điều 9a)`} />
        <Stat label="Đến hạn trong 3 ngày" value={dueSoon} tone={dueSoon > 0 ? 'warn' : 'default'} hint="Nhắc khách trước hạn (QT-KD-01 bước 11)" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6">
        <Card title="Tuổi nợ" badge={<RuleBadge />} bodyClassName="grid grid-cols-1 gap-6 px-5 py-4 lg:grid-cols-[3fr_2fr]">
          <BarList items={BUCKETS.map((b) => ({ label: AGING_LABEL[b], value: summary[b], display: formatVndShort(summary[b]), gap: b !== 'TRONG_HAN', href: `/cong-no?nhom=${b}` }))} emptyText="Không còn công nợ" />
          <ul className="space-y-1.5 self-center text-sm text-muted">
            {(['QH_31_60', 'QH_61_90', 'QH_TREN_90'] as const).map((b) => <li key={b}><b>{AGING_LABEL[b]}:</b> {AGING_ACTION[b]}</li>)}
          </ul>
        </Card>
        <Card
          title={bucket ? AGING_LABEL[bucket] : 'Chi tiết công nợ'}
          actions={
            <form method="get" className="flex gap-2">
              <Select name="owner" defaultValue={sp.owner ?? ''} placeholder="Mọi người phụ trách" options={owners.map((o) => ({ value: o.id, label: o.name }))} />
              <button className="rounded-xl border border-line px-3 text-sm font-semibold">Lọc</button>
            </form>
          }
        >
          <div className="mb-3 flex gap-3 text-sm">
            {bucket && <Link href="/cong-no" className="text-brand hover:underline">Bỏ lọc nhóm tuổi nợ</Link>}
            {!bucket && (sp.da_thu === '1' ? <Link href="/cong-no" className="text-brand hover:underline">Ẩn khoản đã thu đủ</Link> : <Link href="/cong-no?da_thu=1" className="text-brand hover:underline">Hiện cả khoản đã thu đủ</Link>)}
          </div>
          {sorted.length === 0 ? (
            <p className="text-sm text-muted">Không có khoản phải thu.</p>
          ) : (
            <Table>
              <thead><tr><Th>Khách hàng</Th><Th>Hóa đơn / đợt</Th><Th>Hạn</Th><Th className="text-right">Còn phải thu</Th><Th>Tuổi nợ</Th></tr></thead>
              <tbody>
                {sorted.map((r) => {
                  const b = agingBucket(r, today)
                  const days = daysOverdue(r.dueDate, today)
                  return (
                    <tr key={r.id} className="hover:bg-zinc-50">
                      <Td><Link href={`/khach-hang/${r.customer.id}`} className="font-semibold hover:text-brand">{r.customer.name}</Link><div className="text-xs text-muted">{r.owner?.name ?? 'Chưa giao'}</div></Td>
                      <Td><Link href={`/cong-no/${r.id}`} className="whitespace-nowrap hover:text-brand">{r.docNo ?? r.description}</Link><div className="text-xs text-muted">{r.description}</div><div className="num whitespace-nowrap text-xs text-muted">{r.contract?.projectCode ?? r.contract?.number ?? 'Không theo hợp đồng'}</div></Td>
                      <Td className="whitespace-nowrap">{formatDate(r.dueDate)}{days > 0 && outstanding(r) > 0 && <div className="text-xs text-red-700">quá {days} ngày</div>}</Td>
                      <Td className="num text-right">{formatVnd(outstanding(r))}<div className="text-xs text-muted">/ {formatVnd(r.amount)}</div></Td>
                      <Td><Badge tone={b === 'DA_THU_DU' ? 'green' : b === 'TRONG_HAN' ? 'blue' : b === 'QH_1_30' ? 'orange' : 'red'}>{AGING_LABEL[b]}</Badge></Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  )
}
