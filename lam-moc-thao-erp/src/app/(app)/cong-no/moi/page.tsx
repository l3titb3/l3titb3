import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can, customerScope } from '@/lib/permissions'
import { Card, Notice, PageHeader } from '@/components/ui'
import { ActionForm } from '@/components/action-form'
import { Field, FormGrid, Input, Select } from '@/components/form'
import { toInputDate, todayVN } from '@/lib/rules/dates'
import { addReceivable } from '../actions'

export const metadata = { title: 'Ghi công nợ' }

export default async function NewReceivablePage() {
  const user = await requireUser()
  if (!can.manageReceivables(user)) redirect('/cong-no')
  const [customers, contracts] = await Promise.all([
    prisma.customer.findMany({ where: { AND: [customerScope(user), { type: 'TO_CHUC' }] }, orderBy: { name: 'asc' }, select: { id: true, name: true, code: true } }),
    prisma.contract.findMany({ where: { status: { in: ['DA_KY', 'HOAN_THANH'] } }, orderBy: { createdAt: 'desc' }, select: { id: true, number: true, customer: { select: { name: true } } } }),
  ])
  return (
    <>
      <PageHeader title="Ghi công nợ phải thu" back={{ href: '/cong-no', label: 'Công nợ phải thu' }} />
      <div className="mb-4"><Notice tone="indigo">Công nợ theo hợp đồng nên ghi tại trang hợp đồng. Mẫu này dùng cho đơn đặt hàng (BM-KD-03) của khách tổ chức không có hợp đồng. Khách lẻ thanh toán 100% khi giao, không ghi nợ.</Notice></div>
      <Card>
        <ActionForm action={addReceivable} submitLabel="Ghi công nợ">
          <input type="hidden" name="redirect" value="detail" />
          <FormGrid>
            <Field label="Khách hàng (tổ chức)" required><Select name="customerId" required placeholder="Chọn khách hàng" options={customers.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))} /></Field>
            <Field label="Hợp đồng (nếu có)"><Select name="contractId" placeholder="Không theo hợp đồng" options={contracts.map((c) => ({ value: c.id, label: `${c.number} · ${c.customer.name}` }))} /></Field>
            <Field label="Số hóa đơn / đợt"><Input name="docNo" /></Field>
            <Field label="Nội dung" required><Input name="description" required /></Field>
            <Field label="Ngày hóa đơn" required><Input name="issueDate" type="date" defaultValue={toInputDate(todayVN())} required /></Field>
            <Field label="Thời hạn thanh toán (ngày)" hint="Tổ chức mua hàng: 15 ngày"><Input name="termDays" defaultValue={15} inputMode="numeric" /></Field>
            <Field label="Giá trị gồm VAT (đồng)" required><Input name="amount" inputMode="numeric" required /></Field>
            <Field label="Ghi chú"><Input name="note" /></Field>
          </FormGrid>
        </ActionForm>
      </Card>
    </>
  )
}
