'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { ContractType } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireUser, type SessionUser } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { audit } from '@/lib/audit'
import { nextSeq } from '@/lib/counters'
import { getCompany } from '@/lib/settings'
import { roundVnd } from '@/lib/rules/money'
import { contractApprovalStep, contractSignerLevel, needsProjectCode } from '@/lib/rules/approval'
import { COUNTER_KEYS, formatContractNumber, formatProjectCode } from '@/lib/rules/numbering'
import { dateOnlyToInstant, diffDays, parseDateOnly, todayVN } from '@/lib/rules/dates'
import { advanceDueDate, afterSalesDates } from '@/lib/rules/followups'
import { isDeliveryOnHold, outstanding } from '@/lib/rules/aging'
import { num, str, type ActionState } from '@/lib/action'
import { visibleContract, visibleCustomer, visibleQuote } from '@/lib/queries/access'
import { VAT_RATES } from '@/lib/labels'

const TYPES: ContractType[] = ['MUA_BAN', 'CHO_THUE', 'THI_CONG', 'CHAM_SOC', 'VSMT']
/** Hợp đồng theo kỳ cần ngày bắt đầu, kết thúc để nhắc tái ký */
const TERM_TYPES: ContractType[] = ['CHO_THUE', 'CHAM_SOC', 'VSMT']

async function readContract(user: SessionUser, fd: FormData) {
  const type = str(fd, 'type') as ContractType | null
  const customerId = str(fd, 'customerId')
  const segmentId = str(fd, 'segmentId')
  const title = str(fd, 'title')
  const value = num(fd, 'value')
  const vatRate = num(fd, 'vatRate')
  if (!type || !TYPES.includes(type)) return { error: 'Chọn loại hợp đồng' }
  if (!customerId) return { error: 'Chọn khách hàng' }
  await visibleCustomer(user, customerId)
  if (!segmentId || !(await prisma.segment.findUnique({ where: { id: segmentId } }))) return { error: 'Chọn mảng kinh doanh' }
  if (!title) return { error: 'Nhập tên, nội dung hợp đồng' }
  if (value === null || value <= 0) return { error: 'Nhập giá trị hợp đồng chưa VAT' }
  if (vatRate === null || !VAT_RATES.includes(vatRate)) return { error: 'Thuế suất GTGT không hợp lệ' }
  const startDate = parseDateOnly(str(fd, 'startDate'))
  const endDate = parseDateOnly(str(fd, 'endDate'))
  if (TERM_TYPES.includes(type) && (!startDate || !endDate)) return { error: 'Hợp đồng cho thuê, chăm sóc, vệ sinh môi trường cần ngày bắt đầu và kết thúc' }
  if (startDate && endDate && endDate <= startDate) return { error: 'Ngày kết thúc phải sau ngày bắt đầu' }
  const advancePercent = num(fd, 'advancePercent') ?? 0
  const retentionPercent = num(fd, 'retentionPercent') ?? 0
  if (advancePercent < 0 || advancePercent > 100) return { error: 'Tỷ lệ tạm ứng không hợp lệ' }
  // Điều 6 Quy chế tài chính: giữ lại bảo hành tối đa 5%
  if (retentionPercent < 0 || retentionPercent > 5) return { error: 'Tỷ lệ giữ lại bảo hành tối đa 5%' }
  const paymentTermDays = Math.round(num(fd, 'paymentTermDays') ?? 15)
  const warrantyDays = num(fd, 'warrantyDays')
  const roundedValue = roundVnd(value)
  const vatAmount = roundVnd((roundedValue * vatRate) / 100)
  return {
    data: {
      type,
      customerId,
      segmentId,
      title,
      value: roundedValue,
      vatRate,
      vatAmount,
      total: roundedValue + vatAmount,
      startDate,
      endDate,
      paymentTermDays,
      advancePercent,
      retentionPercent,
      warrantyDays: warrantyDays === null ? null : Math.round(warrantyDays),
      note: str(fd, 'note'),
    },
  }
}

export async function saveContract(contractId: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  if (!can.sell(user)) return { error: 'Bạn không có quyền soạn hợp đồng' }
  const parsed = await readContract(user, fd)
  if ('error' in parsed) return { error: parsed.error }
  const { data } = parsed
  const company = await getCompany()
  const signerLevel = contractSignerLevel(data.type, data.total, company)
  const ownerId = can.assignOwner(user) ? (str(fd, 'ownerId') ?? user.id) : user.id

  if (contractId) {
    const current = await visibleContract(user, contractId)
    if (current.status !== 'SOAN_THAO') return { error: 'Chỉ sửa hợp đồng đang soạn thảo' }
    if (!can.editSales(user, current)) return { error: 'Bạn không có quyền sửa hợp đồng này' }
    if (current.type !== data.type || current.customerId !== data.customerId) return { error: 'Không đổi loại hợp đồng, khách hàng sau khi đã cấp số. Hủy và lập hợp đồng mới.' }
    await prisma.contract.update({ where: { id: contractId }, data: { ...data, signerLevel, ownerId } })
    await audit(prisma, { userId: user.id, action: 'SUA', entity: 'Contract', entityId: contractId })
    redirect(`/hop-dong/${contractId}`)
  }

  const quoteId = str(fd, 'quoteId')
  if (quoteId) {
    const quote = await visibleQuote(user, quoteId)
    if (quote.customerId !== data.customerId) return { error: 'Báo giá không thuộc khách hàng đã chọn' }
    if (!['DA_DUYET', 'DA_GUI', 'THANG'].includes(quote.status)) return { error: 'Chỉ lập hợp đồng từ báo giá đã duyệt' }
    if (await prisma.contract.findFirst({ where: { quoteId, status: { not: 'HUY' } } })) return { error: 'Báo giá này đã có hợp đồng' }
  }
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: data.customerId } })
  const year = todayVN().getUTCFullYear()
  const created = await prisma.$transaction(async (tx) => {
    const seq = await nextSeq(tx, COUNTER_KEYS.contract(data.type, year))
    if (quoteId) await tx.contract.updateMany({ where: { quoteId, status: 'HUY' }, data: { quoteId: null } })
    const c = await tx.contract.create({
      data: { ...data, number: formatContractNumber(data.type, seq, year, customer.code), year, seq, quoteId, signerLevel, ownerId, createdById: user.id },
    })
    await audit(tx, { userId: user.id, action: 'TAO', entity: 'Contract', entityId: c.id, detail: c.number })
    return c
  })
  redirect(`/hop-dong/${created.id}`)
}

async function load(id: string) {
  const user = await requireUser()
  const contract = await visibleContract(user, id)
  return { user, contract }
}

function done(id: string, ok: string): ActionState {
  revalidatePath(`/hop-dong/${id}`)
  revalidatePath('/hop-dong')
  return { ok }
}

/** Kiểm tra trước khi trình ký: hồ sơ khách tổ chức, nợ quá hạn */
async function preSignCheck(user: SessionUser, customerId: string): Promise<string | null> {
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId }, include: { receivables: true } })
  if (customer.type === 'TO_CHUC' && !customer.taxCode) return 'Khách hàng tổ chức chưa có mã số thuế (QT-KD-01 mục 4). Bổ sung hồ sơ khách hàng trước khi trình ký.'
  if (isDeliveryOnHold(customer.receivables, todayVN()) && user.role !== 'GIAM_DOC') {
    return 'Khách hàng có nợ quá hạn trên 30 ngày: tạm dừng giao hàng mới (Điều 7 Quy chế tài chính). Cần Giám đốc trình hoặc thu nợ trước.'
  }
  return null
}

export async function submitContract(id: string): Promise<ActionState> {
  const { user, contract } = await load(id)
  if (!can.editSales(user, contract)) return { error: 'Bạn không có quyền trình hợp đồng này' }
  if (contract.status !== 'SOAN_THAO') return { error: 'Hợp đồng không ở trạng thái soạn thảo' }
  const check = await preSignCheck(user, contract.customerId)
  if (check) return { error: check }
  const company = await getCompany()
  const signerLevel = contractSignerLevel(contract.type, contract.total, company)
  await prisma.contract.update({ where: { id }, data: { status: 'CHO_DUYET', signerLevel, reviewedAt: null, reviewedById: null, proposedAt: null, proposedById: null } })
  await audit(prisma, { userId: user.id, action: 'TRINH_DUYET', entity: 'Contract', entityId: id, detail: signerLevel })
  return done(id, 'Đã trình. Phòng HCKT rà soát trước khi trình ký.')
}

/** Phòng HCKT rà soát hình thức hợp đồng (Điều 9: KS) */
export async function reviewContract(id: string): Promise<ActionState> {
  const { user, contract } = await load(id)
  if (!can.reviewContract(user)) return { error: 'Chỉ Phòng HCKT hoặc Giám đốc rà soát hợp đồng' }
  if (contract.status !== 'CHO_DUYET' || contract.reviewedAt) return { error: 'Hợp đồng không chờ rà soát' }
  await prisma.contract.update({ where: { id }, data: { reviewedAt: new Date(), reviewedById: user.id } })
  await audit(prisma, { userId: user.id, action: 'RA_SOAT', entity: 'Contract', entityId: id })
  return done(id, 'Đã rà soát')
}

export async function proposeContract(id: string): Promise<ActionState> {
  const { user, contract } = await load(id)
  if (contract.status !== 'CHO_DUYET' || !contract.reviewedAt) return { error: 'Hợp đồng chưa được rà soát' }
  if (contractApprovalStep(user, contract) !== 'PROPOSE') return { error: 'Bạn không có quyền đề xuất hợp đồng này' }
  await prisma.contract.update({ where: { id }, data: { proposedAt: new Date(), proposedById: user.id } })
  await audit(prisma, { userId: user.id, action: 'DE_XUAT', entity: 'Contract', entityId: id })
  return done(id, 'Đã đề xuất, chờ Chủ tịch HĐTV phê duyệt')
}

export async function approveContract(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, contract } = await load(id)
  if (contract.status !== 'CHO_DUYET' || !contract.reviewedAt) return { error: 'Hợp đồng chưa được Phòng HCKT rà soát' }
  if (contractApprovalStep(user, contract) !== 'APPROVE') return { error: 'Bạn không có thẩm quyền phê duyệt hợp đồng này' }
  const check = await preSignCheck(user, contract.customerId)
  if (check && !check.startsWith('Khách hàng có nợ quá hạn')) return { error: check }
  const signDate = parseDateOnly(str(fd, 'signDate')) ?? todayVN()
  const segment = await prisma.segment.findUniqueOrThrow({ where: { id: contract.segmentId } })
  const now = new Date()
  await prisma.$transaction(async (tx) => {
    let projectCode = contract.projectCode
    if (!projectCode && needsProjectCode(segment, contract.value)) {
      const year = signDate.getUTCFullYear()
      projectCode = formatProjectCode(await nextSeq(tx, COUNTER_KEYS.project(year)), year)
    }
    await tx.contract.update({
      where: { id },
      data: { status: 'DA_KY', approvedAt: now, approvedById: user.id, signDate, startDate: contract.startDate ?? signDate, projectCode },
    })
    await tx.customer.update({ where: { id: contract.customerId }, data: { status: 'DANG_GIAO_DICH' } })
    if (contract.quoteId) {
      const quote = await tx.quote.update({ where: { id: contract.quoteId }, data: { status: 'THANG', closedAt: now } })
      if (quote.opportunityId) await tx.opportunity.update({ where: { id: quote.opportunityId }, data: { stage: 'THANG', closedAt: now, stageChangedAt: now } })
      await tx.activity.updateMany({ where: { quoteId: quote.id, doneAt: null, auto: true }, data: { doneAt: now, result: 'Đã ký hợp đồng' } })
    }
    // QT-KD-01 bước 8: thu tạm ứng trước khi triển khai
    if (contract.advancePercent > 0) {
      const due = advanceDueDate(signDate)
      await tx.receivable.create({
        data: {
          customerId: contract.customerId,
          contractId: id,
          ownerId: contract.ownerId,
          docNo: 'Tạm ứng đợt 1',
          description: `Tạm ứng ${contract.advancePercent}% hợp đồng ${contract.number}`,
          issueDate: signDate,
          termDays: diffDays(due, signDate),
          dueDate: due,
          amount: roundVnd((contract.total * contract.advancePercent) / 100),
          createdById: user.id,
        },
      })
    }
    await audit(tx, { userId: user.id, action: 'PHE_DUYET_KY', entity: 'Contract', entityId: id, detail: projectCode ?? undefined })
  })
  return done(id, 'Hợp đồng đã được phê duyệt, ký')
}

export async function returnContract(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, contract } = await load(id)
  if (contract.status !== 'CHO_DUYET') return { error: 'Hợp đồng không chờ duyệt' }
  const allowed = can.reviewContract(user) || contractApprovalStep(user, contract) !== null
  if (!allowed) return { error: 'Bạn không có quyền trả lại hợp đồng này' }
  const reason = str(fd, 'reason')
  if (!reason) return { error: 'Nhập lý do trả về' }
  await prisma.contract.update({ where: { id }, data: { status: 'SOAN_THAO', reviewedAt: null, reviewedById: null, proposedAt: null, proposedById: null } })
  await audit(prisma, { userId: user.id, action: 'TRA_VE_SOAN_THAO', entity: 'Contract', entityId: id, detail: reason })
  return done(id, 'Đã trả về soạn thảo')
}

export async function waiveAdvance(id: string): Promise<ActionState> {
  const { user, contract } = await load(id)
  if (!can.waiveAdvance(user)) return { error: 'Chỉ Giám đốc chấp thuận triển khai trước khi nhận tạm ứng' }
  if (contract.status !== 'DA_KY') return { error: 'Hợp đồng chưa ký' }
  await prisma.contract.update({ where: { id }, data: { advanceWaived: true } })
  await audit(prisma, { userId: user.id, action: 'CHAP_THUAN_TAM_UNG', entity: 'Contract', entityId: id })
  return done(id, 'Đã chấp thuận triển khai')
}

/** Nghiệm thu, giao xong: hẹn hỏi thăm sau 07 ngày và 30 ngày (QT-KD-01 bước 12) */
export async function completeContract(id: string): Promise<ActionState> {
  const { user, contract } = await load(id)
  if (!can.editSales(user, contract) && user.role !== 'PGD_KY_THUAT') return { error: 'Bạn không có quyền' }
  if (contract.status !== 'DA_KY') return { error: 'Hợp đồng chưa ở trạng thái đang thực hiện' }
  const today = todayVN()
  await prisma.$transaction(async (tx) => {
    await tx.contract.update({ where: { id }, data: { status: 'HOAN_THANH', completedAt: new Date() } })
    const [d7, d30] = afterSalesDates(today)
    for (const [due, label] of [[d7, '07 ngày'], [d30, '30 ngày']] as const) {
      await tx.activity.create({
        data: { type: 'CHAM_SOC_SAU_BAN', subject: `Hỏi thăm khách sau ${label} (${contract.number})`, customerId: contract.customerId, contractId: id, assigneeId: contract.ownerId ?? user.id, dueAt: dateOnlyToInstant(due), auto: true, createdById: user.id },
      })
    }
    await audit(tx, { userId: user.id, action: 'HOAN_THANH', entity: 'Contract', entityId: id })
  })
  return done(id, 'Đã ghi nhận nghiệm thu. Hệ thống hẹn hỏi thăm khách sau 7 và 30 ngày.')
}

export async function liquidateContract(id: string): Promise<ActionState> {
  const { user, contract } = await load(id)
  if (!can.editSales(user, contract) && !can.manageReceivables(user)) return { error: 'Bạn không có quyền' }
  if (!['DA_KY', 'HOAN_THANH'].includes(contract.status)) return { error: 'Trạng thái hợp đồng không phù hợp để thanh lý' }
  const receivables = await prisma.receivable.findMany({ where: { contractId: id } })
  const remaining = receivables.reduce((s, r) => s + outstanding(r), 0)
  if (remaining > 0) return { error: 'Hợp đồng còn công nợ chưa thu. Thu đủ trước khi thanh lý (BM-KD-10).' }
  await prisma.contract.update({ where: { id }, data: { status: 'THANH_LY', liquidatedAt: new Date() } })
  await audit(prisma, { userId: user.id, action: 'THANH_LY', entity: 'Contract', entityId: id })
  return done(id, 'Đã thanh lý hợp đồng')
}

export async function cancelContract(id: string): Promise<ActionState> {
  const { user, contract } = await load(id)
  if (!can.editSales(user, contract)) return { error: 'Bạn không có quyền' }
  if (!['SOAN_THAO', 'CHO_DUYET'].includes(contract.status)) return { error: 'Không hủy được hợp đồng đã ký' }
  await prisma.contract.update({ where: { id }, data: { status: 'HUY' } })
  await audit(prisma, { userId: user.id, action: 'HUY', entity: 'Contract', entityId: id })
  return done(id, 'Đã hủy hợp đồng')
}

