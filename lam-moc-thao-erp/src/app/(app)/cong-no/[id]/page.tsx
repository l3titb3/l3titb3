import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Printer } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can, receivableScope } from '@/lib/permissions'
import { Badge, Card, DescList, Notice, PageHeader, Table, Td, Th, buttonClass } from '@/components/ui'
import { ActionForm } from '@/components/action-form'
import { Field, FormGrid, Input, Select } from '@/components/form'
import { History } from '@/components/history'
import { AGING_ACTION, AGING_LABEL, agingBucket, daysOverdue, outstanding } from '@/lib/rules/aging'
import { formatVnd } from '@/lib/rules/money'
import { formatDate, toInputDate, todayVN } from '@/lib/rules/dates'
import { PAYMENT_METHOD_LABEL } from '@/lib/labels'
import { addPayment, deletePayment, deleteReceivable, remindDebt } from '../actions'

export const metadata = { title: 'Khoản phải thu' }

export default async function ReceivableDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const r = await prisma.receivable.findFirst({
    where: { AND: [{ id }, receivableScope(user)] },
    include: { customer: true, contract: true, owner: { select: { name: true } }, payments: { orderBy: { date: 'asc' } } },
  })
  if (!r) notFound()
  const today = todayVN()
  const b = agingBucket(r, today)
  const rest = outstanding(r)
  const manage = can.manageReceivables(user)

  return (
    <>
      <PageHeader
        title={r.docNo ?? r.description}
        back={{ href: '/cong-no', label: 'Công nợ phải thu' }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={b === 'DA_THU_DU' ? 'green' : b === 'TRONG_HAN' ? 'blue' : 'red'}>{AGING_LABEL[b]}</Badge>
            <Link href={`/khach-hang/${r.customerId}`} className="font-semibold text-brand hover:underline">{r.customer.name}</Link>
            {r.contract && <>· <Link href={`/hop-dong/${r.contract.id}`} className="num hover:underline">{r.contract.number}</Link></>}
          </span>
        }
        actions={
          <>
            {r.contract && <Link href={`/in/de-nghi-thanh-toan/${id}`} target="_blank" className={buttonClass('secondary')}><Printer className="size-4" /> Đề nghị thanh toán</Link>}
            {rest > 0 && <ActionForm action={remindDebt.bind(null, id)} submitLabel="Giao việc nhắc nợ" variant="secondary" inline />}
          </>
        }
      />
      {AGING_ACTION[b] && <div className="mb-6"><Notice tone="red">Quá hạn {daysOverdue(r.dueDate, today)} ngày. Biện pháp: {AGING_ACTION[b]}.</Notice></div>}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Thông tin khoản phải thu">
            <DescList
              items={[
                ['Nội dung', r.description],
                ['Số hóa đơn / đợt', r.docNo ?? '-'],
                ['Ngày hóa đơn', formatDate(r.issueDate)],
                ['Thời hạn', `${r.termDays} ngày, đến ${formatDate(r.dueDate)}`],
                ['Giá trị gồm VAT', `${formatVnd(r.amount)} đ`],
                ['Đã thu', `${formatVnd(r.paidAmount)} đ`],
                ['Còn phải thu', <b key="c">{formatVnd(rest)} đ</b>],
                ['Người phụ trách thu', r.owner?.name],
                ['Mã công trình', r.contract?.projectCode ?? '-'],
                ['Ghi chú', r.note ?? '-'],
              ]}
            />
          </Card>
          <Card title="Phiếu thu">
            {r.payments.length === 0 ? (
              <p className="text-sm text-muted">Chưa thu.</p>
            ) : (
              <Table>
                <thead><tr><Th>Ngày</Th><Th>Hình thức</Th><Th>Chứng từ</Th><Th className="text-right">Số tiền</Th><Th /></tr></thead>
                <tbody>
                  {r.payments.map((p) => (
                    <tr key={p.id}>
                      <Td>{formatDate(p.date)}</Td>
                      <Td>{PAYMENT_METHOD_LABEL[p.method]}</Td>
                      <Td>{p.reference ?? '-'}{p.note && <div className="text-xs text-muted">{p.note}</div>}</Td>
                      <Td className="num text-right">{formatVnd(p.amount)}</Td>
                      <Td className="text-right">{manage && <ActionForm action={deletePayment.bind(null, p.id)} submitLabel="Xóa" variant="ghost" size="sm" inline confirm="Xóa phiếu thu ghi nhầm?" />}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            {manage && rest > 0 && (
              <div className="mt-4 rounded-xl bg-zinc-50 p-4">
                <ActionForm action={addPayment.bind(null, id)} submitLabel="Ghi phiếu thu" size="sm">
                  <FormGrid>
                    <Field label="Ngày thu" required><Input name="date" type="date" defaultValue={toInputDate(today)} required /></Field>
                    <Field label="Số tiền (đồng)" required><Input name="amount" defaultValue={rest} inputMode="numeric" required /></Field>
                    <Field label="Hình thức"><Select name="method" defaultValue="CHUYEN_KHOAN" options={Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => ({ value, label }))} /></Field>
                    <Field label="Số chứng từ, mã giao dịch"><Input name="reference" /></Field>
                  </FormGrid>
                </ActionForm>
              </div>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Lịch sử">
            <History entity="Receivable" entityId={id} />
          </Card>
          {manage && r.payments.length === 0 && (
            <ActionForm action={deleteReceivable.bind(null, id)} submitLabel="Xóa khoản phải thu ghi nhầm" variant="ghost" size="sm" confirm="Xóa khoản phải thu này?" />
          )}
        </div>
      </div>
    </>
  )
}
