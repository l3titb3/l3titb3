import Link from 'next/link'
import { Printer } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can } from '@/lib/permissions'
import { visibleQuote } from '@/lib/queries/access'
import { Badge, ButtonLink, Card, DescList, Notice, PageHeader, Table, Td, Th, buttonClass } from '@/components/ui'
import { ActionForm } from '@/components/action-form'
import { Field, Textarea } from '@/components/form'
import { History } from '@/components/history'
import { QUOTE_STATUS_LABEL, ROLE_LABEL } from '@/lib/labels'
import { formatPercent, formatVnd } from '@/lib/rules/money'
import { formatDate, formatDateTime, todayVN } from '@/lib/rules/dates'
import { canApproveQuote } from '@/lib/rules/approval'
import { grossMarginPercent } from '@/lib/rules/pricing'
import { quoteStatusTone } from '@/lib/tones'
import { approveQuote, cancelQuote, markQuoteLost, markSent, markWon, rejectQuote, reviseQuote, submitQuote } from '../actions'

export const metadata = { title: 'Chi tiết báo giá' }

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  await visibleQuote(user, id)
  const q = await prisma.quote.findUniqueOrThrow({
    where: { id },
    include: {
      customer: true,
      opportunity: true,
      segment: true,
      lines: { orderBy: { sortOrder: 'asc' } },
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      contract: { select: { id: true, number: true } },
    },
  })
  const owner = can.editSales(user, { createdById: q.createdById })
  const approver = q.status === 'CHO_DUYET' && canApproveQuote(user, q.approvalLevel)
  const expired = ['DA_DUYET', 'DA_GUI'].includes(q.status) && q.validUntil < todayVN()
  const floor = q.segment.floorMargin

  return (
    <>
      <PageHeader
        title={`Báo giá ${q.number}`}
        back={{ href: '/bao-gia', label: 'Báo giá' }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={quoteStatusTone(q.status)}>{QUOTE_STATUS_LABEL[q.status]}</Badge>
            {expired && <Badge tone="orange">Hết hiệu lực từ {formatDate(q.validUntil)}</Badge>}
            <Link href={`/khach-hang/${q.customerId}`} className="font-semibold text-brand hover:underline">{q.customer.name}</Link>
            {q.opportunity && <>· <Link href={`/co-hoi/${q.opportunity.id}`} className="hover:underline">{q.opportunity.code}</Link></>}
          </span>
        }
        actions={
          <>
            <Link href={`/in/bao-gia/${id}`} target="_blank" className={buttonClass('secondary')}><Printer className="size-4" /> In báo giá</Link>
            {owner && ['NHAP', 'TU_CHOI'].includes(q.status) && <ButtonLink href={`/bao-gia/${id}/sua`} variant="secondary">Sửa</ButtonLink>}
            {can.sell(user) && ['DA_DUYET', 'DA_GUI', 'THUA', 'TU_CHOI', 'HUY'].includes(q.status) && (
              <ActionForm action={reviseQuote.bind(null, id)} submitLabel="Tạo bản sửa đổi" variant="secondary" inline />
            )}
          </>
        }
      />

      <Card title={q.title ?? 'Hạng mục báo giá'} badge={<Badge tone="gray">{q.segment.name}</Badge>}>
        <Table>
          <thead>
            <tr><Th>STT</Th><Th>Hạng mục / Quy cách</Th><Th>ĐVT</Th><Th className="text-right">SL</Th><Th className="text-right">Đơn giá</Th><Th className="text-right">Thành tiền</Th><Th className="text-right">Giá vốn</Th><Th className="text-right">Biên</Th></tr>
          </thead>
          <tbody>
            {q.lines.map((l, i) => {
              const m = grossMarginPercent(l.amount, l.costAmount)
              return (
                <tr key={l.id}>
                  <Td>{i + 1}</Td>
                  <Td className="min-w-48">{l.name}{l.spec && <div className="text-xs text-muted">{l.spec}</div>}</Td>
                  <Td>{l.unit}</Td>
                  <Td className="num text-right">{l.quantity.toLocaleString('vi-VN')}</Td>
                  <Td className="num text-right">{formatVnd(l.unitPrice)}</Td>
                  <Td className="num text-right font-medium">{formatVnd(l.amount)}</Td>
                  <Td className="num text-right text-muted">{formatVnd(l.costAmount)}</Td>
                  <Td className={`num text-right ${floor !== null && m < floor ? 'font-semibold text-red-700' : 'text-muted'}`}>{formatPercent(m)}</Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
        <dl className="ml-auto mt-4 max-w-sm space-y-1.5 text-sm">
          <Line label="Cộng tiền hàng" value={formatVnd(q.subtotal)} />
          <Line label={`Thuế GTGT ${q.vatRate}%`} value={formatVnd(q.vatAmount)} />
          <Line label="Tổng cộng" value={formatVnd(q.total)} strong />
          <Line label="Giá vốn dự kiến (nội bộ)" value={formatVnd(q.costTotal)} />
          <Line label="Biên LN gộp" value={`${formatPercent(q.grossMargin)}${floor !== null ? ` (sàn ${floor}%)` : ''}`} warn={floor !== null && q.grossMargin < floor} />
        </dl>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">

          <Card title="Điều kiện báo giá">
            <DescList
              items={[
                ['Ngày báo giá', formatDate(q.quoteDate)],
                ['Hiệu lực đến', formatDate(q.validUntil)],
                ['Giá đã bao gồm', [q.includesShipping && 'vận chuyển', q.includesInstall && 'trồng, lắp đặt', q.warrantyDays && `bảo hành ${q.warrantyDays} ngày`].filter(Boolean).join(', ') || 'Không'],
                ['Thời gian thực hiện', q.executionDays ? `${q.executionDays} ngày` : '-'],
                ['Thanh toán', q.paymentTerms ?? '-'],
                ['Người liên hệ', [q.contactName, q.contactPhone].filter(Boolean).join(' · ') || '-'],
                ['Ghi chú nội bộ', q.note ?? '-'],
                ['Người lập', q.createdBy.name],
              ]}
            />
          </Card>

          <Card title="Lịch sử">
            <History entity="Quote" entityId={id} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Phê duyệt (QT-KD-01 bước 5)">
            {q.approvalLevel ? (
              <div className="space-y-2 text-sm">
                <p>Cấp duyệt: <b>{ROLE_LABEL[q.approvalLevel]}</b></p>
                {q.approvalReasons.length > 0 && <ul className="list-disc pl-5 text-amber-800">{q.approvalReasons.map((r) => <li key={r}>{r}</li>)}</ul>}
                {q.submittedAt && <p className="text-muted">Trình lúc {formatDateTime(q.submittedAt)}</p>}
                {q.approvedBy && <p className="text-emerald-700">Đã duyệt: {q.approvedBy.name}, {formatDateTime(q.approvedAt)}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted">Chưa trình duyệt.</p>
            )}
            {q.status === 'TU_CHOI' && q.rejectedReason && <div className="mt-3"><Notice tone="red">Bị trả lại: {q.rejectedReason}</Notice></div>}

            <div className="mt-4 space-y-3">
              {owner && ['NHAP', 'TU_CHOI'].includes(q.status) && <ActionForm action={submitQuote.bind(null, id)} submitLabel="Trình duyệt" />}
              {approver && (
                <>
                  <ActionForm action={approveQuote.bind(null, id)} submitLabel="Duyệt báo giá" />
                  <ActionForm action={rejectQuote.bind(null, id)} submitLabel="Trả lại" variant="danger" size="sm">
                    <Field label="Lý do trả lại"><Textarea name="reason" rows={2} /></Field>
                  </ActionForm>
                </>
              )}
              {q.status === 'CHO_DUYET' && !approver && <p className="text-sm text-muted">Đang chờ {q.approvalLevel ? ROLE_LABEL[q.approvalLevel] : ''} duyệt.</p>}
              {owner && ['NHAP', 'TU_CHOI', 'CHO_DUYET'].includes(q.status) && (
                <ActionForm action={cancelQuote.bind(null, id)} submitLabel="Hủy báo giá" variant="ghost" size="sm" confirm="Hủy báo giá này?" />
              )}
            </div>
          </Card>

          {owner && ['DA_DUYET', 'DA_GUI'].includes(q.status) && (
            <Card title="Kết quả với khách">
              <div className="space-y-3">
                {q.status === 'DA_DUYET' && <ActionForm action={markSent.bind(null, id)} submitLabel="Ghi nhận đã gửi khách" />}
                {q.status === 'DA_GUI' && <p className="text-sm text-muted">Gửi khách lúc {formatDateTime(q.sentAt)}. Hệ thống đã hẹn gọi lại sau 02 ngày làm việc.</p>}
                <ActionForm action={markWon.bind(null, id)} submitLabel="Khách đồng ý" variant="secondary" />
                <ActionForm action={markQuoteLost.bind(null, id)} submitLabel="Khách không đồng ý" variant="danger" size="sm">
                  <Field label="Lý do (để rút kinh nghiệm)"><Textarea name="reason" rows={2} /></Field>
                </ActionForm>
              </div>
            </Card>
          )}

          {q.status === 'THANG' && (
            <Card title="Bước tiếp theo">
              {q.contract ? (
                <p className="text-sm">Đã lập hợp đồng <Link href={`/hop-dong/${q.contract.id}`} className="num font-semibold text-brand hover:underline">{q.contract.number}</Link>.</p>
              ) : q.segmentId === 'BAN_LE' ? (
                <p className="text-sm text-muted">Đơn bán lẻ: thu 100% khi giao hàng. Có thể lập hợp đồng mua bán nếu khách yêu cầu.</p>
              ) : (
                <p className="text-sm text-muted">Khách đã đồng ý. Lập hợp đồng theo mẫu để trình ký (QT-KD-01 bước 7).</p>
              )}
              {!q.contract && can.sell(user) && <div className="mt-3"><ButtonLink href={`/hop-dong/moi?bao-gia=${id}`}>Lập hợp đồng từ báo giá</ButtonLink></div>}
            </Card>
          )}
          {q.status === 'THUA' && q.lostReason && <Notice tone="red">Không thành: {q.lostReason}</Notice>}
        </div>
      </div>
    </>
  )
}

function Line({ label, value, strong, warn }: { label: string; value: string; strong?: boolean; warn?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={`num ${strong ? 'text-base font-bold' : ''} ${warn ? 'font-semibold text-red-700' : ''}`}>{value}</dd>
    </div>
  )
}
