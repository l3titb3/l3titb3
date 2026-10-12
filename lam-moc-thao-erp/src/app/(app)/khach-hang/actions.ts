'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { ActivityType, CustomerStatus, CustomerType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { audit } from '@/lib/audit'
import { nextSeq } from '@/lib/counters'
import { getCompany } from '@/lib/settings'
import { creditLimitError } from '@/lib/rules/approval'
import { COUNTER_KEYS, formatCustomerCode } from '@/lib/rules/numbering'
import { dateOnlyToInstant, parseDateOnly } from '@/lib/rules/dates'
import { num, str, type ActionState } from '@/lib/action'
import { visibleCustomer } from '@/lib/queries/access'
import { ACTIVITY_LABEL } from '@/lib/labels'

const TYPES: CustomerType[] = ['CA_NHAN', 'TO_CHUC']
const STATUSES: CustomerStatus[] = ['TIEM_NANG', 'DANG_GIAO_DICH', 'NGUNG']

function readCustomer(fd: FormData) {
  const type = str(fd, 'type') as CustomerType | null
  const status = (str(fd, 'status') ?? 'TIEM_NANG') as CustomerStatus
  const data = {
    name: str(fd, 'name'),
    type,
    status,
    industry: str(fd, 'industry'),
    source: str(fd, 'source'),
    area: str(fd, 'area'),
    address: str(fd, 'address'),
    taxCode: str(fd, 'taxCode'),
    legalRep: str(fd, 'legalRep'),
    contactName: str(fd, 'contactName'),
    contactTitle: str(fd, 'contactTitle'),
    contactPhone: str(fd, 'contactPhone'),
    contactEmail: str(fd, 'contactEmail'),
    invoiceInfo: str(fd, 'invoiceInfo'),
    note: str(fd, 'note'),
  }
  let error: string | null = null
  if (!data.name || data.name.length < 2) error = 'Nhập tên khách hàng'
  else if (!type || !TYPES.includes(type)) error = 'Chọn loại khách hàng'
  else if (!STATUSES.includes(status)) error = 'Trạng thái không hợp lệ'
  else if (data.taxCode && !/^\d{10}(-\d{3})?$/.test(data.taxCode)) error = 'Mã số thuế gồm 10 chữ số (chi nhánh: 10 số - 3 số)'
  else if (data.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail)) error = 'Email liên hệ không hợp lệ'
  else if (data.contactPhone && data.contactPhone.replace(/\D/g, '').length < 9) error = 'Số điện thoại không hợp lệ'
  return { data: data as typeof data & { name: string; type: CustomerType }, error }
}

async function duplicateError(data: { taxCode: string | null; contactPhone: string | null }, excludeId?: string): Promise<string | null> {
  const or: Prisma.CustomerWhereInput[] = []
  if (data.taxCode) or.push({ taxCode: data.taxCode })
  if (data.contactPhone) or.push({ contactPhone: data.contactPhone })
  if (or.length === 0) return null
  const dup = await prisma.customer.findFirst({ where: { OR: or, ...(excludeId ? { id: { not: excludeId } } : {}) } })
  if (!dup) return null
  const field = data.taxCode && dup.taxCode === data.taxCode ? 'mã số thuế' : 'số điện thoại'
  return `Đã có khách hàng ${dup.code} - ${dup.name} cùng ${field}. Kiểm tra lại để tránh trùng.`
}

export async function createCustomer(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  if (!can.sell(user)) return { error: 'Bạn không có quyền thêm khách hàng' }
  const { data, error } = readCustomer(fd)
  if (error) return { error }
  const dup = await duplicateError(data)
  if (dup) return { error: dup }

  const company = await getCompany()
  const creditLimit = num(fd, 'creditLimit') ?? 0
  const paymentTermDays = num(fd, 'paymentTermDays') ?? 0
  if (creditLimit !== 0) {
    const e = creditLimitError(user, data.type, creditLimit, company)
    if (e) return { error: e }
  }
  const ownerId = can.assignOwner(user) ? str(fd, 'ownerId') : user.id

  const customer = await prisma.$transaction(async (tx) => {
    const seq = await nextSeq(tx, COUNTER_KEYS.customer())
    const c = await tx.customer.create({
      data: { ...data, code: formatCustomerCode(seq), ownerId, creditLimit, paymentTermDays, createdById: user.id },
    })
    await audit(tx, { userId: user.id, action: 'TAO', entity: 'Customer', entityId: c.id, detail: c.code })
    return c
  })
  redirect(`/khach-hang/${customer.id}`)
}

export async function updateCustomer(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const current = await visibleCustomer(user, id)
  if (!can.editCustomer(user, current)) return { error: 'Bạn không có quyền sửa khách hàng này' }
  const { data, error } = readCustomer(fd)
  if (error) return { error }
  const dup = await duplicateError(data, id)
  if (dup) return { error: dup }

  const company = await getCompany()
  const update: Prisma.CustomerUncheckedUpdateInput = { ...data }
  const creditLimit = num(fd, 'creditLimit')
  const paymentTermDays = num(fd, 'paymentTermDays')
  if (creditLimit !== null && creditLimit !== current.creditLimit) {
    const e = creditLimitError(user, data.type, creditLimit, company)
    if (e) return { error: e }
    update.creditLimit = creditLimit
  } else if (data.type === 'CA_NHAN' && current.creditLimit > 0) {
    return { error: 'Khách lẻ không được cho nợ: đặt hạn mức nợ về 0 trước khi đổi loại khách hàng' }
  }
  if (paymentTermDays !== null && can.assignOwner(user)) update.paymentTermDays = paymentTermDays
  if (can.assignOwner(user)) update.ownerId = str(fd, 'ownerId')

  await prisma.customer.update({ where: { id }, data: update })
  await audit(prisma, { userId: user.id, action: 'SUA', entity: 'Customer', entityId: id })
  redirect(`/khach-hang/${id}`)
}

const ACTIVITY_TYPES = Object.keys(ACTIVITY_LABEL) as ActivityType[]
const CONTACT_TYPES: ActivityType[] = ['GOI_DIEN', 'ZALO', 'GAP_MAT', 'EMAIL']

export async function addActivity(customerId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  await visibleCustomer(user, customerId)
  const type = str(fd, 'type') as ActivityType | null
  const subject = str(fd, 'subject')
  const mode = str(fd, 'mode') ?? 'done'
  if (!type || !ACTIVITY_TYPES.includes(type)) return { error: 'Chọn loại hoạt động' }
  if (!subject) return { error: 'Nhập nội dung chính' }
  const opportunityId = str(fd, 'opportunityId')
  if (opportunityId) {
    const opp = await prisma.opportunity.findFirst({ where: { id: opportunityId, customerId } })
    if (!opp) return { error: 'Cơ hội không thuộc khách hàng này' }
  }
  let dueAt: Date | null = null
  if (mode === 'plan') {
    const due = parseDateOnly(str(fd, 'dueDate'))
    if (!due) return { error: 'Chọn ngày hẹn thực hiện' }
    dueAt = dateOnlyToInstant(due)
  }
  const now = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.activity.create({
      data: {
        type,
        subject,
        content: str(fd, 'content'),
        customerId,
        opportunityId,
        assigneeId: mode === 'plan' ? (str(fd, 'assigneeId') ?? user.id) : user.id,
        dueAt,
        doneAt: mode === 'plan' ? null : now,
        createdById: user.id,
      },
    })
    // QT-KD-01 bước 1: lần liên hệ đầu tiên với khách
    if (mode !== 'plan' && CONTACT_TYPES.includes(type) && opportunityId) {
      await tx.opportunity.updateMany({ where: { id: opportunityId, firstContactAt: null }, data: { firstContactAt: now } })
    }
  })
  revalidatePath(`/khach-hang/${customerId}`)
  if (opportunityId) revalidatePath(`/co-hoi/${opportunityId}`)
  return { ok: mode === 'plan' ? 'Đã hẹn việc' : 'Đã ghi nhận' }
}

export async function completeActivity(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const activity = await prisma.activity.findUnique({ where: { id } })
  if (!activity) return { error: 'Không tìm thấy việc' }
  await visibleCustomer(user, activity.customerId)
  if (activity.assigneeId !== user.id && !can.assignOwner(user) && user.role !== 'GIAM_DOC') {
    return { error: 'Chỉ người được giao hoặc quản lý mới đánh dấu hoàn thành' }
  }
  const now = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.activity.update({ where: { id }, data: { doneAt: now, result: str(fd, 'result') } })
    if (CONTACT_TYPES.includes(activity.type) && activity.opportunityId) {
      await tx.opportunity.updateMany({ where: { id: activity.opportunityId, firstContactAt: null }, data: { firstContactAt: now } })
    }
  })
  revalidatePath('/viec-can-lam')
  revalidatePath(`/khach-hang/${activity.customerId}`)
  return { ok: 'Đã hoàn thành' }
}
