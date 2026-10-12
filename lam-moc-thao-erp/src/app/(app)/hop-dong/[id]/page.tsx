import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can } from '@/lib/permissions'
import { visibleContract } from '@/lib/queries/access'
import { Badge, ButtonLink, Card, DescList, Notice, PageHeader, Table, Td, Th } from '@/components/ui'
import { ActionForm } from '@/components/action-form'
import { Field, FormGrid, Input, Textarea } from '@/components/form'
import { History } from '@/components/history'
import { CONTRACT_STATUS_LABEL, CONTRACT_TYPE_LABEL, SIGNER_LABEL } from '@/lib/labels'
import { formatVnd } from '@/lib/rules/money'
import { formatDate, formatDateTime, toInputDate, todayVN } from '@/lib/rules/dates'
import { AGING_LABEL, agingBucket, isDeliveryOnHold, outstanding } from '@/lib/rules/aging'
import { contractApprovalStep, SIGNER_BASIS } from '@/lib/rules/approval'
import { contractStatusTone } from '@/lib/tones'
import { cn } from '@/lib/cn'
import { approveContract, cancelContract, completeContract, liquidateContract, proposeContract, returnContract, reviewContract, submitContract, waiveAdvance } from '../actions'
import { addReceivable } from '../../cong-no/actions'

export const metadata = { title: 'Chi tiết hợp đồng' }

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  await visibleContract(user, id)
  const c = await prisma.contract.findUniqueOrThrow({
    where: { id },
    include: {
      customer: { include: { receivables: { select: { amount: true, paidAmount: true, dueDate: true } } } },
      segment: true,
      quote: { select: { id: true, number: true } },
      owner: { select: { name: true } },
      reviewedBy: { select: { name: true } },
      proposedBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      receivables: { orderBy: { issueDate: 'asc' }, include: { payments: { orderBy: { date: 'asc' } } } },
    },
  })
  const today = todayVN()
  const editable = can.editSales(user, c)
  const step = c.status === 'CHO_DUYET' && c.reviewedAt ? contractApprovalStep(user, c) : null
  const canReview = c.status === 'CHO_DUYET' && !c.reviewedAt && can.reviewContract(user)
  const billed = c.receivables.reduce((s, r) => s + r.amount, 0)
  const paid = c.receivables.reduce((s, r) => s + r.paidAmount, 0)
  const advance = c.receivables.find((r) => r.docNo === 'Tạm ứng đợt 1')
  const advancePending = c.status === 'DA_KY' && c.advancePercent > 0 && advance && outstanding(advance) > 0 && !c.advanceWaived
  const hold = isDeliveryOnHold(c.customer.receivables, today)
  const orgMissingTax = c.customer.type === 'TO_CHUC' && !c.customer.taxCode

  const flow = [
    { label: 'Soạn thảo', done: c.status !== 'SOAN_THAO' },
    { label: 'HCKT rà soát', done: !!c.reviewedAt || ['DA_KY', 'HOAN_THANH', 'THANH_LY'].includes(c.status) },
    ...(c.signerLevel === 'CHU_TICH' ? [{ label: 'GĐ đề xuất', done: !!c.proposedAt || ['DA_KY', 'HOAN_THANH', 'THANH_LY'].includes(c.status) }] : []),
    { label: `${SIGNER_LABEL[c.signerLevel]} duyệt, ký`, done: ['DA_KY', 'HOAN_THANH', 'THANH_LY'].includes(c.status) },
    { label: 'Nghiệm thu', done: ['HOAN_THANH', 'THANH_LY'].includes(c.status) },
    { label: 'Thanh lý', done: c.status === 'THANH_LY' },
  ]

  return (
    <>
      <PageHeader
        title={`Hợp đồng ${c.number}`}
        back={{ href: '/hop-dong', label: 'Hợp đồng' }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={contractStatusTone(c.status)}>{CONTRACT_STATUS_LABEL[c.status]}</Badge>
            {c.projectCode && <Badge tone="indigo">Mã công trình {c.projectCode}</Badge>}
            <Link href={`/khach-hang/${c.customerId}`} className="font-semibold text-brand hover:underline">{c.customer.name}</Link>
            {c.quote && <>· theo báo giá <Link href={`/bao-gia/${c.quote.id}`} className="num hover:underline">{c.quote.number}</Link></>}
          </span>
        }
        actions={
          <>
            {editable && c.status === 'SOAN_THAO' && <ButtonLink href={`/hop-dong/${id}/sua`} variant="secondary">Sửa</ButtonLink>}
            {editable && ['SOAN_THAO', 'CHO_DUYET'].includes(c.status) && <ActionForm action={cancelContract.bind(null, id)} submitLabel="Hủy" variant="ghost" inline confirm="Hủy hợp đồng này?" />}
          </>
        }
      />

      {c.status !== 'HUY' && (
        <ol className="mb-6 flex flex-wrap gap-1 text-xs font-semibold">
          {flow.map((f) => (
            <li key={f.label} className={cn('flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-center', f.done ? 'bg-brand text-white' : 'bg-white text-muted ring-1 ring-line')}>{f.label}</li>
          ))}
        </ol>
      )}

      <div className="mb-6 space-y-3">
        {hold && ['SOAN_THAO', 'CHO_DUYET'].includes(c.status) && <Notice tone="red">Khách hàng có nợ quá hạn trên 30 ngày: tạm dừng giao hàng mới (Điều 7 Quy chế tài chính). Chỉ Giám đốc được trình ký trong trường hợp này.</Notice>}
        {orgMissingTax && ['SOAN_THAO', 'CHO_DUYET'].includes(c.status) && <Notice>Khách hàng tổ chức chưa có mã số thuế. Bổ sung hồ sơ khách hàng (QT-KD-01 mục 4) trước khi trình ký.</Notice>}
        {advancePending && <Notice>Chưa nhận đủ tạm ứng {c.advancePercent}%: chưa triển khai giao hàng, thi công (QT-KD-01 bước 8), trừ khi Giám đốc chấp thuận.</Notice>}
        {c.advanceWaived && c.status === 'DA_KY' && <Notice tone="indigo">Giám đốc đã chấp thuận triển khai trước khi nhận tạm ứng.</Notice>}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title={c.title}>
            <DescList
              items={[
                ['Loại hợp đồng', CONTRACT_TYPE_LABEL[c.type]],
                ['Mảng kinh doanh', c.segment.name],
                ['Giá trị chưa VAT', `${formatVnd(c.value)} đ`],
                [`Thuế GTGT ${c.vatRate}%`, `${formatVnd(c.vatAmount)} đ`],
                ['Tổng giá trị thanh toán', <b key="t">{formatVnd(c.total)} đ</b>],
                ['Người phụ trách', c.owner?.name],
                ['Ngày ký', c.signDate ? formatDate(c.signDate) : '-'],
                ['Thời hạn', c.endDate ? `${formatDate(c.startDate)} - ${formatDate(c.endDate)}` : c.startDate ? `Từ ${formatDate(c.startDate)}` : '-'],
                ['Thanh toán mỗi đợt', `${c.paymentTermDays} ngày`],
                ['Tạm ứng', c.advancePercent > 0 ? `${c.advancePercent}%` : 'Không'],
                ['Giữ lại bảo hành', c.retentionPercent > 0 ? `${c.retentionPercent}%` : 'Không'],
                ['Bảo hành', c.warrantyDays ? `${c.warrantyDays} ngày` : '-'],
                ['Ghi chú', c.note ?? '-'],
              ]}
            />
          </Card>

          <Card
            title="Thanh toán, công nợ"
            actions={<span className="num text-sm text-muted">Đã ghi {formatVnd(billed)} / {formatVnd(c.total)} đ · Đã thu {formatVnd(paid)} đ</span>}
          >
            {c.receivables.length === 0 ? (
              <p className="text-sm text-muted">Chưa ghi đợt thanh toán, hóa đơn nào.</p>
            ) : (
              <Table>
                <thead><tr><Th>Đợt / Hóa đơn</Th><Th>Ngày, hạn</Th><Th className="text-right">Giá trị</Th><Th className="text-right">Đã thu</Th><Th>Tình trạng</Th></tr></thead>
                <tbody>
                  {c.receivables.map((r) => {
                    const b = agingBucket(r, today)
                    return (
                      <tr key={r.id}>
                        <Td><Link href={`/cong-no/${r.id}`} className="font-semibold hover:text-brand">{r.docNo ?? 'Chưa có số'}</Link><div className="text-xs text-muted">{r.description}</div></Td>
                        <Td className="whitespace-nowrap">{formatDate(r.issueDate)}<div className="text-xs text-muted">hạn {formatDate(r.dueDate)}</div></Td>
                        <Td className="num text-right">{formatVnd(r.amount)}</Td>
                        <Td className="num text-right">{formatVnd(r.paidAmount)}</Td>
                        <Td><Badge tone={b === 'DA_THU_DU' ? 'green' : b === 'TRONG_HAN' ? 'blue' : 'red'}>{AGING_LABEL[b]}</Badge></Td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            )}
            {can.manageReceivables(user) && ['DA_KY', 'HOAN_THANH'].includes(c.status) && billed < c.total && (
              <details className="mt-4 rounded-xl border border-line px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-brand">+ Ghi đợt thanh toán / hóa đơn</summary>
                <div className="mt-3">
                  <ActionForm action={addReceivable} submitLabel="Ghi công nợ" size="sm">
                    <input type="hidden" name="customerId" value={c.customerId} />
                    <input type="hidden" name="contractId" value={id} />
                    <FormGrid>
                      <Field label="Số hóa đơn / đợt"><Input name="docNo" placeholder="HĐ 0000035 hoặc Đợt 2" /></Field>
                      <Field label="Nội dung" required><Input name="description" required placeholder="Thanh toán đợt 2 sau nghiệm thu" /></Field>
                      <Field label="Ngày hóa đơn" required><Input name="issueDate" type="date" defaultValue={toInputDate(today)} required /></Field>
                      <Field label="Thời hạn thanh toán (ngày)"><Input name="termDays" defaultValue={c.paymentTermDays} inputMode="numeric" /></Field>
                      <Field label="Giá trị gồm VAT (đồng)" required hint={`Còn chưa ghi: ${formatVnd(c.total - billed)} đ`}><Input name="amount" inputMode="numeric" required /></Field>
                    </FormGrid>
                  </ActionForm>
                </div>
              </details>
            )}
          </Card>

          <Card title="Lịch sử">
            <History entity="Contract" entityId={id} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Phê duyệt, ký">
            <p className="text-sm">{SIGNER_BASIS[c.signerLevel]}.</p>
            <ul className="mt-3 space-y-1 text-sm text-muted">
              {c.reviewedBy && <li>Rà soát: {c.reviewedBy.name}, {formatDateTime(c.reviewedAt)}</li>}
              {c.proposedBy && <li>Đề xuất: {c.proposedBy.name}, {formatDateTime(c.proposedAt)}</li>}
              {c.approvedBy && <li className="text-emerald-700">Phê duyệt, ký: {c.approvedBy.name}, {formatDateTime(c.approvedAt)}</li>}
            </ul>
            <div className="mt-4 space-y-3">
              {editable && c.status === 'SOAN_THAO' && <ActionForm action={submitContract.bind(null, id)} submitLabel="Trình duyệt" />}
              {canReview && <ActionForm action={reviewContract.bind(null, id)} submitLabel="Xác nhận đã rà soát hình thức" />}
              {step === 'PROPOSE' && <ActionForm action={proposeContract.bind(null, id)} submitLabel="Đề xuất Chủ tịch HĐTV phê duyệt" />}
              {step === 'APPROVE' && (
                <ActionForm action={approveContract.bind(null, id)} submitLabel="Phê duyệt, ký hợp đồng">
                  <Field label="Ngày ký"><Input name="signDate" type="date" defaultValue={toInputDate(today)} /></Field>
                </ActionForm>
              )}
              {c.status === 'CHO_DUYET' && (canReview || step) && (
                <ActionForm action={returnContract.bind(null, id)} submitLabel="Trả về soạn thảo" variant="danger" size="sm">
                  <Field label="Lý do"><Textarea name="reason" rows={2} /></Field>
                </ActionForm>
              )}
              {c.status === 'CHO_DUYET' && !canReview && !step && (
                <p className="text-sm text-muted">{c.reviewedAt ? `Đang chờ ${c.signerLevel === 'CHU_TICH' && !c.proposedAt ? 'Giám đốc đề xuất' : SIGNER_LABEL[c.signerLevel] + ' phê duyệt'}.` : 'Đang chờ Phòng HCKT rà soát.'}</p>
              )}
            </div>
          </Card>

          {['DA_KY', 'HOAN_THANH'].includes(c.status) && (
            <Card title="Thực hiện hợp đồng">
              <div className="space-y-3">
                {advancePending && can.waiveAdvance(user) && <ActionForm action={waiveAdvance.bind(null, id)} submitLabel="Chấp thuận triển khai trước tạm ứng" variant="secondary" size="sm" />}
                {c.status === 'DA_KY' && (editable || user.role === 'PGD_KY_THUAT') && (
                  <ActionForm action={completeContract.bind(null, id)} submitLabel="Ghi nhận nghiệm thu / giao xong" variant="secondary" />
                )}
                {(editable || can.manageReceivables(user)) && (
                  <ActionForm action={liquidateContract.bind(null, id)} submitLabel="Thanh lý hợp đồng" variant="ghost" size="sm" confirm="Thanh lý hợp đồng? Chỉ thực hiện khi đã hoàn tất nghĩa vụ hai bên." />
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
