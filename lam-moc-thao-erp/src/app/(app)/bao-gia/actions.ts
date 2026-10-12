'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Prisma, Quote } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireUser, type SessionUser } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { audit } from '@/lib/audit'
import { nextSeq } from '@/lib/counters'
import { getCompany } from '@/lib/settings'
import { computeTotals, lineAmount, lineCost } from '@/lib/rules/pricing'
import { canApproveQuote, quoteApprovalLevel } from '@/lib/rules/approval'
import { COUNTER_KEYS, formatQuoteNumber } from '@/lib/rules/numbering'
import { addDays, dateOnlyToInstant, parseDateOnly, todayVN } from '@/lib/rules/dates'
import { quoteCallbackDate } from '@/lib/rules/followups'
import { num, str, type ActionState } from '@/lib/action'
import { visibleCustomer, visibleQuote } from '@/lib/queries/access'
import { VAT_RATES } from '@/lib/labels'

const lineSchema = z.object({
  productId: z.string().nullable(),
  name: z.string().min(1, 'Mỗi dòng cần tên hạng mục'),
  spec: z.string().nullable(),
  unit: z.string().min(1, 'Mỗi dòng cần đơn vị tính'),
  quantity: z.number().positive('Số lượng phải lớn hơn 0'),
  unitPrice: z.number().min(0, 'Đơn giá không được âm'),
  unitCost: z.number().min(0, 'Giá vốn không được âm'),
})

async function readQuote(user: SessionUser, fd: FormData) {
  const customerId = str(fd, 'customerId')
  const segmentId = str(fd, 'segmentId')
  const quoteDate = parseDateOnly(str(fd, 'quoteDate'))
  const vatRate = num(fd, 'vatRate')
  if (!customerId) return { error: 'Chọn khách hàng' }
  await visibleCustomer(user, customerId)
  if (!segmentId) return { error: 'Chọn mảng kinh doanh' }
  const segment = await prisma.segment.findUnique({ where: { id: segmentId } })
  if (!segment) return { error: 'Mảng kinh doanh không hợp lệ' }
  if (!quoteDate) return { error: 'Chọn ngày báo giá' }
  if (vatRate === null || !VAT_RATES.includes(vatRate)) return { error: 'Thuế suất GTGT không hợp lệ' }

  let rawLines: unknown
  try {
    rawLines = JSON.parse(String(fd.get('lines') ?? '[]'))
  } catch {
    return { error: 'Dữ liệu hạng mục không hợp lệ' }
  }
  const lines = z.array(lineSchema).min(1, 'Báo giá cần ít nhất một hạng mục').safeParse(rawLines)
  if (!lines.success) return { error: lines.error.issues[0].message }
  const productIds = lines.data.map((l) => l.productId).filter((x): x is string => !!x)
  if (productIds.length) {
    const found = await prisma.product.count({ where: { id: { in: productIds } } })
    if (found !== new Set(productIds).size) return { error: 'Có hàng hóa không còn trong danh mục' }
  }

  const opportunityId = str(fd, 'opportunityId')
  if (opportunityId) {
    const opp = await prisma.opportunity.findFirst({ where: { id: opportunityId, customerId } })
    if (!opp) return { error: 'Cơ hội không thuộc khách hàng đã chọn' }
  }
  const company = await getCompany()
  const totals = computeTotals(lines.data, vatRate)
  return {
    data: {
      customerId,
      opportunityId,
      segmentId,
      title: str(fd, 'title'),
      quoteDate,
      validUntil: addDays(quoteDate, company.quoteValidDays),
      vatRate,
      includesShipping: fd.get('includesShipping') === 'on',
      includesInstall: fd.get('includesInstall') === 'on',
      warrantyDays: num(fd, 'warrantyDays'),
      executionDays: num(fd, 'executionDays'),
      paymentTerms: str(fd, 'paymentTerms'),
      contactName: str(fd, 'contactName'),
      contactPhone: str(fd, 'contactPhone'),
      note: str(fd, 'note'),
      ...totals,
    },
    lines: lines.data.map((l, i) => ({ ...l, sortOrder: i, amount: lineAmount(l), costAmount: lineCost(l) })),
  }
}

export async function saveQuote(quoteId: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  if (!can.sell(user)) return { error: 'Bạn không có quyền lập báo giá' }
  const parsed = await readQuote(user, fd)
  if ('error' in parsed) return { error: parsed.error }
  const { data, lines } = parsed
  const warrantyDays = data.warrantyDays === null ? null : Math.round(data.warrantyDays)
  const executionDays = data.executionDays === null ? null : Math.round(data.executionDays)

  let id = quoteId
  if (quoteId) {
    const current = await visibleQuote(user, quoteId)
    if (!['NHAP', 'TU_CHOI'].includes(current.status)) return { error: 'Chỉ sửa được báo giá nháp hoặc bị trả lại. Hãy tạo bản sửa đổi.' }
    if (!can.editSales(user, { createdById: current.createdById, ownerId: undefined })) return { error: 'Bạn không có quyền sửa báo giá này' }
    await prisma.$transaction(async (tx) => {
      await tx.quoteLine.deleteMany({ where: { quoteId } })
      await tx.quote.update({
        where: { id: quoteId },
        data: { ...data, warrantyDays, executionDays, status: 'NHAP', approvalLevel: null, approvalReasons: [], submittedAt: null, rejectedReason: null, lines: { create: lines } },
      })
      await audit(tx, { userId: user.id, action: 'SUA', entity: 'Quote', entityId: quoteId })
    })
  } else {
    const year = data.quoteDate.getUTCFullYear()
    const created = await prisma.$transaction(async (tx) => {
      const seq = await nextSeq(tx, COUNTER_KEYS.quote(year))
      const q = await tx.quote.create({
        data: { ...data, warrantyDays, executionDays, number: formatQuoteNumber(seq, year), year, seq, createdById: user.id, lines: { create: lines } },
      })
      if (data.opportunityId) {
        await tx.opportunity.updateMany({ where: { id: data.opportunityId, stage: { in: ['TIEP_NHAN', 'KHAO_SAT'] } }, data: { stage: 'BAO_GIA', stageChangedAt: new Date() } })
      }
      await audit(tx, { userId: user.id, action: 'TAO', entity: 'Quote', entityId: q.id, detail: q.number })
      return q
    })
    id = created.id
  }
  redirect(`/bao-gia/${id}`)
}

async function loadForAction(id: string) {
  const user = await requireUser()
  const quote = await visibleQuote(user, id)
  return { user, quote }
}

function done(id: string, ok: string): ActionState {
  revalidatePath(`/bao-gia/${id}`)
  revalidatePath('/bao-gia')
  return { ok }
}

/** QT-KD-01 bước 5: trình duyệt, xác định cấp duyệt theo biên LN và giá trị */
export async function submitQuote(id: string): Promise<ActionState> {
  const { user, quote } = await loadForAction(id)
  if (!can.editSales(user, { createdById: quote.createdById })) return { error: 'Bạn không có quyền trình báo giá này' }
  if (!['NHAP', 'TU_CHOI'].includes(quote.status)) return { error: 'Báo giá không ở trạng thái nháp' }
  const [company, segment] = await Promise.all([getCompany(), prisma.segment.findUniqueOrThrow({ where: { id: quote.segmentId } })])
  const approval = quoteApprovalLevel({ total: quote.total, grossMargin: quote.grossMargin, floorMargin: segment.floorMargin }, company)
  await prisma.quote.update({
    where: { id },
    data: { status: 'CHO_DUYET', approvalLevel: approval.level, approvalReasons: approval.reasons, submittedAt: new Date(), rejectedReason: null },
  })
  await audit(prisma, { userId: user.id, action: 'TRINH_DUYET', entity: 'Quote', entityId: id, detail: approval.level })
  return done(id, 'Đã trình duyệt')
}

export async function approveQuote(id: string): Promise<ActionState> {
  const { user, quote } = await loadForAction(id)
  if (quote.status !== 'CHO_DUYET') return { error: 'Báo giá không chờ duyệt' }
  if (!canApproveQuote(user, quote.approvalLevel)) return { error: 'Báo giá này cần Giám đốc duyệt' }
  await prisma.quote.update({ where: { id }, data: { status: 'DA_DUYET', approvedById: user.id, approvedAt: new Date() } })
  await audit(prisma, { userId: user.id, action: 'DUYET', entity: 'Quote', entityId: id })
  return done(id, 'Đã duyệt báo giá')
}

export async function rejectQuote(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, quote } = await loadForAction(id)
  if (quote.status !== 'CHO_DUYET') return { error: 'Báo giá không chờ duyệt' }
  if (!canApproveQuote(user, quote.approvalLevel)) return { error: 'Bạn không có quyền duyệt báo giá này' }
  const reason = str(fd, 'reason')
  if (!reason) return { error: 'Nhập lý do trả lại để người lập điều chỉnh' }
  await prisma.quote.update({ where: { id }, data: { status: 'TU_CHOI', rejectedReason: reason } })
  await audit(prisma, { userId: user.id, action: 'TRA_LAI', entity: 'Quote', entityId: id, detail: reason })
  return done(id, 'Đã trả lại báo giá')
}

/** QT-KD-01 bước 6: gửi báo giá, hẹn gọi lại sau 02 ngày */
export async function markSent(id: string): Promise<ActionState> {
  const { user, quote } = await loadForAction(id)
  if (!can.editSales(user, { createdById: quote.createdById })) return { error: 'Bạn không có quyền' }
  if (quote.status !== 'DA_DUYET') return { error: 'Chỉ gửi khách báo giá đã được duyệt' }
  const now = new Date()
  const today = todayVN()
  await prisma.$transaction(async (tx) => {
    await tx.quote.update({ where: { id }, data: { status: 'DA_GUI', sentAt: now } })
    await tx.activity.create({ data: { type: 'GUI_BAO_GIA', subject: `Gửi báo giá ${quote.number}`, customerId: quote.customerId, opportunityId: quote.opportunityId, quoteId: id, assigneeId: user.id, doneAt: now, createdById: user.id } })
    await tx.activity.create({
      data: { type: 'GOI_DIEN', subject: `Gọi lại khách về báo giá ${quote.number}`, customerId: quote.customerId, opportunityId: quote.opportunityId, quoteId: id, assigneeId: user.id, dueAt: dateOnlyToInstant(quoteCallbackDate(today)), auto: true, createdById: user.id },
    })
    if (quote.opportunityId) {
      await tx.activity.updateMany({ where: { opportunityId: quote.opportunityId, type: 'GUI_BAO_GIA', doneAt: null, auto: true }, data: { doneAt: now, result: `Đã gửi ${quote.number}` } })
      await tx.opportunity.updateMany({ where: { id: quote.opportunityId, stage: { in: ['TIEP_NHAN', 'KHAO_SAT'] } }, data: { stage: 'BAO_GIA', stageChangedAt: now } })
    }
    await audit(tx, { userId: user.id, action: 'GUI_KHACH', entity: 'Quote', entityId: id })
  })
  return done(id, 'Đã ghi nhận gửi khách')
}

/** Khách đồng ý báo giá. Bán lẻ: chốt luôn; các mảng khác: chuyển sang lập hợp đồng */
export async function markWon(id: string): Promise<ActionState> {
  const { user, quote } = await loadForAction(id)
  if (!can.editSales(user, { createdById: quote.createdById })) return { error: 'Bạn không có quyền' }
  if (!['DA_DUYET', 'DA_GUI'].includes(quote.status)) return { error: 'Chỉ ghi nhận khách đồng ý với báo giá đã duyệt' }
  const now = new Date()
  const retail = quote.segmentId === 'BAN_LE'
  await prisma.$transaction(async (tx) => {
    await tx.quote.update({ where: { id }, data: { status: 'THANG', closedAt: now, sentAt: quote.sentAt ?? now } })
    await tx.activity.updateMany({ where: { quoteId: id, doneAt: null, auto: true }, data: { doneAt: now, result: 'Khách đồng ý báo giá' } })
    if (quote.opportunityId) {
      await tx.opportunity.update({ where: { id: quote.opportunityId }, data: retail ? { stage: 'THANG', closedAt: now, stageChangedAt: now } : { stage: 'DAM_PHAN', stageChangedAt: now } })
    }
    if (retail) await tx.customer.update({ where: { id: quote.customerId }, data: { status: 'DANG_GIAO_DICH' } })
    await audit(tx, { userId: user.id, action: 'KHACH_DONG_Y', entity: 'Quote', entityId: id })
  })
  return done(id, retail ? 'Đã chốt đơn bán lẻ' : 'Đã ghi nhận. Bước tiếp theo: lập hợp đồng.')
}

export async function markQuoteLost(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, quote } = await loadForAction(id)
  if (!can.editSales(user, { createdById: quote.createdById })) return { error: 'Bạn không có quyền' }
  if (!['DA_DUYET', 'DA_GUI'].includes(quote.status)) return { error: 'Trạng thái báo giá không phù hợp' }
  const reason = str(fd, 'reason')
  if (!reason) return { error: 'Nhập lý do khách không đồng ý' }
  const now = new Date()
  await prisma.$transaction([
    prisma.quote.update({ where: { id }, data: { status: 'THUA', closedAt: now, lostReason: reason } }),
    prisma.activity.updateMany({ where: { quoteId: id, doneAt: null, auto: true }, data: { doneAt: now, result: 'Khách không đồng ý báo giá' } }),
  ])
  await audit(prisma, { userId: user.id, action: 'KHONG_THANH', entity: 'Quote', entityId: id, detail: reason })
  return done(id, 'Đã ghi nhận')
}

export async function cancelQuote(id: string): Promise<ActionState> {
  const { user, quote } = await loadForAction(id)
  if (!can.editSales(user, { createdById: quote.createdById })) return { error: 'Bạn không có quyền' }
  if (!['NHAP', 'TU_CHOI', 'CHO_DUYET'].includes(quote.status)) return { error: 'Không hủy được báo giá đã duyệt' }
  await prisma.quote.update({ where: { id }, data: { status: 'HUY' } })
  await audit(prisma, { userId: user.id, action: 'HUY', entity: 'Quote', entityId: id })
  return done(id, 'Đã hủy báo giá')
}

/** Tạo bản sửa đổi: sao chép thành báo giá nháp mới */
export async function reviseQuote(id: string): Promise<ActionState> {
  const { user, quote } = await loadForAction(id)
  if (!can.sell(user)) return { error: 'Bạn không có quyền lập báo giá' }
  const lines = await prisma.quoteLine.findMany({ where: { quoteId: id }, orderBy: { sortOrder: 'asc' } })
  const today = todayVN()
  const company = await getCompany()
  const year = today.getUTCFullYear()
  const copy = await prisma.$transaction(async (tx) => {
    const seq = await nextSeq(tx, COUNTER_KEYS.quote(year))
    const data: Prisma.QuoteUncheckedCreateInput = {
      ...pickCopyable(quote),
      number: formatQuoteNumber(seq, year),
      year,
      seq,
      quoteDate: today,
      validUntil: addDays(today, company.quoteValidDays),
      note: `Sửa đổi từ ${quote.number}`,
      createdById: user.id,
      lines: { create: lines.map(({ id: _id, quoteId: _q, ...l }) => l) },
    }
    const q = await tx.quote.create({ data })
    await audit(tx, { userId: user.id, action: 'TAO_SUA_DOI', entity: 'Quote', entityId: q.id, detail: quote.number })
    return q
  })
  redirect(`/bao-gia/${copy.id}/sua`)
}

function pickCopyable(q: Quote) {
  return {
    customerId: q.customerId,
    opportunityId: q.opportunityId,
    segmentId: q.segmentId,
    title: q.title,
    vatRate: q.vatRate,
    includesShipping: q.includesShipping,
    includesInstall: q.includesInstall,
    warrantyDays: q.warrantyDays,
    paymentTerms: q.paymentTerms,
    executionDays: q.executionDays,
    contactName: q.contactName,
    contactPhone: q.contactPhone,
    subtotal: q.subtotal,
    vatAmount: q.vatAmount,
    total: q.total,
    costTotal: q.costTotal,
    grossMargin: q.grossMargin,
  }
}
