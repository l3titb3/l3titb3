'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { PaymentMethod } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { audit } from '@/lib/audit'
import { roundVnd } from '@/lib/rules/money'
import { addDays, parseDateOnly, todayVN } from '@/lib/rules/dates'
import { outstanding } from '@/lib/rules/aging'
import { num, str, type ActionState } from '@/lib/action'
import { visibleCustomer } from '@/lib/queries/access'

function revalidate(customerId: string, contractId?: string | null, receivableId?: string) {
  revalidatePath('/cong-no')
  revalidatePath(`/khach-hang/${customerId}`)
  if (contractId) revalidatePath(`/hop-dong/${contractId}`)
  if (receivableId) revalidatePath(`/cong-no/${receivableId}`)
}

/** Ghi một hóa đơn / đợt thanh toán phải thu (file 04.3, sheet Cong no) */
export async function addReceivable(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  if (!can.manageReceivables(user)) return { error: 'Chỉ Phòng HCKT hoặc Giám đốc ghi công nợ' }
  const customerId = str(fd, 'customerId')
  if (!customerId) return { error: 'Chọn khách hàng' }
  const customer = await visibleCustomer(user, customerId)
  const contractId = str(fd, 'contractId')
  const description = str(fd, 'description')
  const issueDate = parseDateOnly(str(fd, 'issueDate'))
  const amount = num(fd, 'amount')
  const termDays = Math.round(num(fd, 'termDays') ?? 0)
  if (!description) return { error: 'Nhập nội dung khoản phải thu' }
  if (!issueDate) return { error: 'Chọn ngày hóa đơn / ngày phát sinh' }
  if (amount === null || amount <= 0) return { error: 'Số tiền phải lớn hơn 0' }
  if (termDays < 0 || termDays > 365) return { error: 'Thời hạn thanh toán không hợp lệ' }

  let ownerId = customer.ownerId
  if (contractId) {
    const contract = await prisma.contract.findFirst({ where: { id: contractId, customerId }, include: { receivables: true } })
    if (!contract) return { error: 'Hợp đồng không thuộc khách hàng này' }
    if (!['DA_KY', 'HOAN_THANH'].includes(contract.status)) return { error: 'Chỉ ghi công nợ cho hợp đồng đã ký' }
    const billed = contract.receivables.reduce((s, r) => s + r.amount, 0)
    if (billed + roundVnd(amount) > contract.total) {
      return { error: `Tổng các đợt (${(billed + roundVnd(amount)).toLocaleString('vi-VN')} đ) vượt giá trị hợp đồng gồm VAT (${contract.total.toLocaleString('vi-VN')} đ)` }
    }
    ownerId = contract.ownerId ?? ownerId
  }
  const r = await prisma.receivable.create({
    data: {
      customerId,
      contractId,
      ownerId,
      docNo: str(fd, 'docNo'),
      description,
      issueDate,
      termDays,
      dueDate: addDays(issueDate, termDays),
      amount: roundVnd(amount),
      note: str(fd, 'note'),
      createdById: user.id,
    },
  })
  await audit(prisma, { userId: user.id, action: 'GHI_CONG_NO', entity: 'Receivable', entityId: r.id, detail: r.docNo ?? undefined })
  if (str(fd, 'redirect') === 'detail') redirect(`/cong-no/${r.id}`)
  revalidate(customerId, contractId)
  return { ok: 'Đã ghi công nợ' }
}

const METHODS: PaymentMethod[] = ['CHUYEN_KHOAN', 'TIEN_MAT']

export async function addPayment(receivableId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  if (!can.manageReceivables(user)) return { error: 'Chỉ Phòng HCKT hoặc Giám đốc ghi phiếu thu' }
  const r = await prisma.receivable.findUnique({ where: { id: receivableId } })
  if (!r) return { error: 'Không tìm thấy khoản phải thu' }
  const date = parseDateOnly(str(fd, 'date'))
  const amount = num(fd, 'amount')
  const method = (str(fd, 'method') ?? 'CHUYEN_KHOAN') as PaymentMethod
  if (!date) return { error: 'Chọn ngày thu' }
  if (date > todayVN()) return { error: 'Ngày thu không được ở tương lai' }
  if (!METHODS.includes(method)) return { error: 'Hình thức thu không hợp lệ' }
  if (amount === null || amount <= 0) return { error: 'Số tiền thu phải lớn hơn 0' }
  const value = roundVnd(amount)
  if (value > outstanding(r)) return { error: `Số tiền thu vượt số còn phải thu (${outstanding(r).toLocaleString('vi-VN')} đ)` }
  await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: { receivableId, customerId: r.customerId, date, amount: value, method, reference: str(fd, 'reference'), note: str(fd, 'note'), createdById: user.id },
    })
    await tx.receivable.update({ where: { id: receivableId }, data: { paidAmount: { increment: value } } })
    if (r.amount - r.paidAmount - value <= 0) {
      await tx.activity.updateMany({ where: { customerId: r.customerId, type: 'NHAC_NO', doneAt: null }, data: { doneAt: new Date(), result: 'Khách đã thanh toán' } })
    }
    await audit(tx, { userId: user.id, action: 'THU_TIEN', entity: 'Receivable', entityId: receivableId, detail: `${value.toLocaleString('vi-VN')} đ (${p.id})` })
  })
  revalidate(r.customerId, r.contractId, receivableId)
  return { ok: 'Đã ghi phiếu thu' }
}

/** Xóa phiếu thu ghi nhầm (giữ lịch sử trong nhật ký) */
export async function deletePayment(paymentId: string): Promise<ActionState> {
  const user = await requireUser()
  if (!can.manageReceivables(user)) return { error: 'Bạn không có quyền' }
  const p = await prisma.payment.findUnique({ where: { id: paymentId }, include: { receivable: true } })
  if (!p) return { error: 'Không tìm thấy phiếu thu' }
  await prisma.$transaction(async (tx) => {
    await tx.payment.delete({ where: { id: paymentId } })
    await tx.receivable.update({ where: { id: p.receivableId }, data: { paidAmount: { decrement: p.amount } } })
    await audit(tx, { userId: user.id, action: 'XOA_PHIEU_THU', entity: 'Receivable', entityId: p.receivableId, detail: `${p.amount.toLocaleString('vi-VN')} đ ngày ${p.date.toISOString().slice(0, 10)}` })
  })
  revalidate(p.customerId, p.receivable.contractId, p.receivableId)
  return { ok: 'Đã xóa phiếu thu' }
}

export async function deleteReceivable(id: string): Promise<ActionState> {
  const user = await requireUser()
  if (!can.manageReceivables(user)) return { error: 'Bạn không có quyền' }
  const r = await prisma.receivable.findUnique({ where: { id }, include: { _count: { select: { payments: true } } } })
  if (!r) return { error: 'Không tìm thấy khoản phải thu' }
  if (r._count.payments > 0) return { error: 'Khoản này đã có phiếu thu, không xóa được' }
  await prisma.receivable.delete({ where: { id } })
  await audit(prisma, { userId: user.id, action: 'XOA', entity: 'Receivable', entityId: id, detail: r.description })
  redirect(r.contractId ? `/hop-dong/${r.contractId}` : '/cong-no')
}

/** Tạo việc nhắc nợ cho người phụ trách (QT-KD-01 bước 11) */
export async function remindDebt(receivableId: string): Promise<ActionState> {
  const user = await requireUser()
  const r = await prisma.receivable.findUnique({ where: { id: receivableId }, include: { customer: true } })
  if (!r) return { error: 'Không tìm thấy khoản phải thu' }
  await visibleCustomer(user, r.customerId)
  await prisma.activity.create({
    data: {
      type: 'NHAC_NO',
      subject: `Nhắc thanh toán ${r.docNo ?? r.description}`,
      customerId: r.customerId,
      contractId: r.contractId,
      assigneeId: r.ownerId ?? r.customer.ownerId ?? user.id,
      dueAt: new Date(),
      createdById: user.id,
    },
  })
  revalidate(r.customerId, r.contractId, receivableId)
  return { ok: 'Đã giao việc nhắc nợ' }
}
