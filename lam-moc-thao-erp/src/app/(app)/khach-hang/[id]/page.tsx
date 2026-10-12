import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can } from '@/lib/permissions'
import { activeUsers, visibleCustomer } from '@/lib/queries/access'
import { Badge, ButtonLink, Card, DescList, Notice, PageHeader, Table, Td, Th } from '@/components/ui'
import { ActivityForm } from '@/components/activity-form'
import { ActivityList } from '@/components/activity-list'
import {
  CONTRACT_STATUS_LABEL,
  CONTRACT_TYPE_SHORT,
  CUSTOMER_STATUS_LABEL,
  CUSTOMER_TYPE_LABEL,
  QUOTE_STATUS_LABEL,
  STAGE_LABEL,
} from '@/lib/labels'
import { formatVnd } from '@/lib/rules/money'
import { formatDate } from '@/lib/rules/dates'
import { todayVN } from '@/lib/rules/dates'
import { AGING_LABEL, agingBucket, isDeliveryOnHold, outstanding, summarizeAging } from '@/lib/rules/aging'
import { addActivity } from '../actions'

export const metadata = { title: 'Chi tiết khách hàng' }

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const c = await visibleCustomer(user, id)
  const [owner, opportunities, quotes, contracts, receivables, activities, users] = await Promise.all([
    c.ownerId ? prisma.user.findUnique({ where: { id: c.ownerId }, select: { name: true } }) : null,
    prisma.opportunity.findMany({ where: { customerId: id }, orderBy: { createdAt: 'desc' }, include: { segment: true } }),
    prisma.quote.findMany({ where: { customerId: id }, orderBy: { createdAt: 'desc' } }),
    prisma.contract.findMany({ where: { customerId: id }, orderBy: { createdAt: 'desc' } }),
    prisma.receivable.findMany({ where: { customerId: id }, orderBy: { dueDate: 'asc' } }),
    prisma.activity.findMany({ where: { customerId: id }, orderBy: [{ doneAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }], include: { assignee: { select: { name: true } } } }),
    activeUsers(),
  ])
  const today = todayVN()
  const aging = summarizeAging(receivables, today)
  const hold = isDeliveryOnHold(receivables, today)

  return (
    <>
      <PageHeader
        title={c.name}
        back={{ href: '/khach-hang', label: 'Khách hàng' }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="num">{c.code}</span>
            <Badge>{CUSTOMER_TYPE_LABEL[c.type]}</Badge>
            <Badge tone={c.status === 'DANG_GIAO_DICH' ? 'green' : c.status === 'TIEM_NANG' ? 'blue' : 'gray'}>{CUSTOMER_STATUS_LABEL[c.status]}</Badge>
            {hold && <Badge tone="red">Tạm dừng giao hàng</Badge>}
          </span>
        }
        actions={
          <>
            {can.editCustomer(user, c) && <ButtonLink href={`/khach-hang/${id}/sua`} variant="secondary">Sửa</ButtonLink>}
            {can.sell(user) && <ButtonLink href={`/co-hoi/moi?khach=${id}`} variant="secondary">+ Cơ hội</ButtonLink>}
            {can.sell(user) && <ButtonLink href={`/bao-gia/moi?khach=${id}`}>+ Báo giá</ButtonLink>}
          </>
        }
      />

      {hold && (
        <div className="mb-6">
          <Notice tone="red">
            Khách hàng có khoản nợ quá hạn trên 30 ngày. Theo Điều 7 Quy chế quản lý tài chính: tạm dừng giao hàng mới cho đến khi thu được nợ.
          </Notice>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Thông tin khách hàng">
            <DescList
              items={[
                ['Phân khúc', c.industry],
                ['Kênh tiếp nhận', c.source],
                ['Khu vực', c.area],
                ['Người phụ trách', owner?.name],
                ['Địa chỉ', c.address],
                ['Mã số thuế', c.type === 'TO_CHUC' ? c.taxCode : c.taxCode ?? '-'],
                ['Người đại diện', c.type === 'TO_CHUC' ? c.legalRep : c.legalRep ?? '-'],
                ['Nhận hóa đơn', c.invoiceInfo ?? '-'],
                ['Người liên hệ', [c.contactName, c.contactTitle].filter(Boolean).join(' - ') || null],
                ['Điện thoại', c.contactPhone],
                ['Email', c.contactEmail ?? '-'],
                ['Ghi chú', c.note ?? '-'],
              ]}
            />
          </Card>

          <Card title="Cơ hội bán hàng">
            {opportunities.length === 0 ? (
              <p className="text-sm text-muted">Chưa có cơ hội.</p>
            ) : (
              <Table>
                <thead>
                  <tr><Th>Mã</Th><Th>Nội dung</Th><Th>Giai đoạn</Th><Th className="text-right">Giá trị dự kiến</Th></tr>
                </thead>
                <tbody>
                  {opportunities.map((o) => (
                    <tr key={o.id}>
                      <Td className="num whitespace-nowrap text-muted">{o.code}</Td>
                      <Td><Link href={`/co-hoi/${o.id}`} className="font-semibold hover:text-brand">{o.title}</Link><div className="text-xs text-muted">{o.segment.name}</div></Td>
                      <Td><Badge tone={o.stage === 'THANG' ? 'green' : o.stage === 'THUA' ? 'gray' : 'indigo'}>{STAGE_LABEL[o.stage]}</Badge></Td>
                      <Td className="num text-right">{formatVnd(o.expectedValue)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card title="Báo giá, hợp đồng">
            {quotes.length === 0 && contracts.length === 0 ? (
              <p className="text-sm text-muted">Chưa có báo giá, hợp đồng.</p>
            ) : (
              <Table>
                <thead>
                  <tr><Th>Số</Th><Th>Loại</Th><Th>Ngày</Th><Th>Trạng thái</Th><Th className="text-right">Giá trị gồm VAT</Th></tr>
                </thead>
                <tbody>
                  {contracts.map((k) => (
                    <tr key={k.id}>
                      <Td><Link href={`/hop-dong/${k.id}`} className="num font-semibold hover:text-brand">{k.number}</Link>{k.projectCode && <div className="text-xs text-muted">{k.projectCode}</div>}</Td>
                      <Td>Hợp đồng {CONTRACT_TYPE_SHORT[k.type].toLowerCase()}</Td>
                      <Td>{formatDate(k.signDate)}</Td>
                      <Td><Badge tone="green">{CONTRACT_STATUS_LABEL[k.status]}</Badge></Td>
                      <Td className="num text-right">{formatVnd(k.total)}</Td>
                    </tr>
                  ))}
                  {quotes.map((q) => (
                    <tr key={q.id}>
                      <Td><Link href={`/bao-gia/${q.id}`} className="num font-semibold hover:text-brand">{q.number}</Link></Td>
                      <Td>Báo giá</Td>
                      <Td>{formatDate(q.quoteDate)}</Td>
                      <Td><Badge tone="indigo">{QUOTE_STATUS_LABEL[q.status]}</Badge></Td>
                      <Td className="num text-right">{formatVnd(q.total)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card title="Chăm sóc khách hàng">
            <div className="mb-6 rounded-xl bg-zinc-50 p-4">
              <ActivityForm
                action={addActivity.bind(null, id)}
                opportunities={opportunities.filter((o) => o.stage !== 'THUA').map((o) => ({ id: o.id, label: `${o.code} · ${o.title}` }))}
                users={users}
                currentUserId={user.id}
              />
            </div>
            <ActivityList items={activities} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Công nợ" actions={<Link href={`/in/doi-chieu/${id}`} target="_blank" className="text-sm font-semibold text-brand hover:underline">Đối chiếu công nợ</Link>}>
            <div className="space-y-2 text-sm">
              <Row label="Còn phải thu" value={`${formatVnd(aging.totalOutstanding)} đ`} strong />
              <Row label="Trong hạn" value={formatVnd(aging.TRONG_HAN)} />
              <Row label="Quá hạn 1-30 ngày" value={formatVnd(aging.QH_1_30)} />
              <Row label="Quá hạn trên 30 ngày" value={formatVnd(aging.over30)} warn={aging.over30 > 0} />
              <hr className="my-2 border-line" />
              <Row label="Hạn mức nợ" value={c.creditLimit > 0 ? formatVnd(c.creditLimit) : 'Không cho nợ'} />
              <Row label="Thời hạn thanh toán" value={c.paymentTermDays > 0 ? `${c.paymentTermDays} ngày` : 'Thanh toán khi giao'} />
              {c.creditLimit > 0 && aging.totalOutstanding > c.creditLimit && <p className="text-xs font-semibold text-red-700">Dư nợ vượt hạn mức được duyệt.</p>}
            </div>
            {receivables.some((r) => outstanding(r) > 0) && (
              <ul className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
                {receivables
                  .filter((r) => outstanding(r) > 0)
                  .map((r) => {
                    const b = agingBucket(r, today)
                    return (
                      <li key={r.id} className="flex items-start justify-between gap-2">
                        <span>
                          {r.docNo ?? r.description}
                          <span className="block text-xs text-muted">Hạn {formatDate(r.dueDate)} · {AGING_LABEL[b]}</span>
                        </span>
                        <span className={`num ${b === 'TRONG_HAN' ? '' : 'text-gap'}`}>{formatVnd(outstanding(r))}</span>
                      </li>
                    )
                  })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}

function Row({ label, value, strong, warn }: { label: string; value: string; strong?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className={`num ${strong ? 'text-base font-bold' : ''} ${warn ? 'font-semibold text-red-700' : ''}`}>{value}</span>
    </div>
  )
}
