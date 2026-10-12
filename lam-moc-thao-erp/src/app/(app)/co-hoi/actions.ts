'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { OpportunityStage, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { audit } from '@/lib/audit'
import { nextSeq } from '@/lib/counters'
import { COUNTER_KEYS, formatCustomerCode, formatOpportunityCode } from '@/lib/rules/numbering'
import { dateOnlyToInstant, parseDateOnly, todayVN } from '@/lib/rules/dates'
import { quoteDeadline, surveyDeadline } from '@/lib/rules/followups'
import { bool, num, str, type ActionState } from '@/lib/action'
import { visibleCustomer, visibleOpportunity } from '@/lib/queries/access'

/** Ô datetime-local nhập theo giờ Việt Nam */
function parseLocalDateTime(value: string | null): Date | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!m) return null
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 7, +m[5]))
}

async function readOpportunity(fd: FormData) {
  const title = str(fd, 'title')
  const segmentId = str(fd, 'segmentId')
  if (!title) return { error: 'Nhập nội dung nhu cầu' }
  if (!segmentId || !(await prisma.segment.findUnique({ where: { id: segmentId } }))) return { error: 'Chọn mảng kinh doanh' }
  const expectedValue = num(fd, 'expectedValue') ?? 0
  if (expectedValue < 0) return { error: 'Giá trị dự kiến không hợp lệ' }
  return {
    data: {
      title,
      segmentId,
      needsSurvey: str(fd, 'kind') !== 'retail',
      expectedValue,
      expectedCloseDate: parseDateOnly(str(fd, 'expectedCloseDate')),
      source: str(fd, 'source'),
      note: str(fd, 'note'),
    },
  }
}

export async function createOpportunity(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  if (!can.sell(user)) return { error: 'Bạn không có quyền tạo cơ hội' }
  const parsed = await readOpportunity(fd)
  if ('error' in parsed) return { error: parsed.error }
  const ownerId = can.assignOwner(user) ? (str(fd, 'ownerId') ?? user.id) : user.id
  const receivedAt = parseLocalDateTime(str(fd, 'receivedAt')) ?? new Date()
  if (receivedAt > new Date(Date.now() + 60000)) return { error: 'Thời điểm tiếp nhận không được ở tương lai' }

  let customerId = str(fd, 'customerId')
  const newName = str(fd, 'newName')
  if (customerId) {
    await visibleCustomer(user, customerId)
  } else if (!newName) {
    return { error: 'Chọn khách hàng hoặc nhập tên khách hàng mới' }
  }

  const opp = await prisma.$transaction(async (tx) => {
    if (!customerId) {
      const phone = str(fd, 'newPhone')
      if (phone) {
        const dup = await tx.customer.findFirst({ where: { contactPhone: phone } })
        if (dup) throw new Error(`Số điện thoại đã có ở khách hàng ${dup.code} - ${dup.name}. Chọn khách hàng này thay vì tạo mới.`)
      }
      const seq = await nextSeq(tx, COUNTER_KEYS.customer())
      const customer = await tx.customer.create({
        data: {
          code: formatCustomerCode(seq),
          name: newName!,
          type: str(fd, 'newType') === 'CA_NHAN' ? 'CA_NHAN' : 'TO_CHUC',
          contactName: str(fd, 'newContact'),
          contactPhone: phone,
          source: parsed.data.source,
          ownerId,
          createdById: user.id,
        },
      })
      customerId = customer.id
    }
    const year = todayVN().getUTCFullYear()
    const seq = await nextSeq(tx, COUNTER_KEYS.opportunity(year))
    const firstContactAt = bool(fd, 'contacted') ? new Date() : null
    const o = await tx.opportunity.create({
      data: { ...parsed.data, code: formatOpportunityCode(seq, year), customerId: customerId!, ownerId, receivedAt, firstContactAt, createdById: user.id },
    })
    // QT-KD-01 bước 3, 4: hẹn khảo sát hoặc lập báo giá trong 02 ngày làm việc
    const today = todayVN()
    await tx.activity.create({
      data: o.needsSurvey
        ? { type: 'KHAO_SAT', subject: 'Phối hợp Phòng KT khảo sát hiện trạng (BM-KD-01)', customerId: o.customerId, opportunityId: o.id, assigneeId: ownerId, dueAt: dateOnlyToInstant(surveyDeadline(today)), auto: true, createdById: user.id }
        : { type: 'GUI_BAO_GIA', subject: 'Lập và gửi báo giá', customerId: o.customerId, opportunityId: o.id, assigneeId: ownerId, dueAt: dateOnlyToInstant(quoteDeadline(today)), auto: true, createdById: user.id },
    })
    await audit(tx, { userId: user.id, action: 'TAO', entity: 'Opportunity', entityId: o.id, detail: o.code })
    return o
  }).catch((e: Error) => ({ error: e.message }))
  if ('error' in opp) return { error: opp.error }
  redirect(`/co-hoi/${opp.id}`)
}

export async function updateOpportunity(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const opp = await visibleOpportunity(user, id)
  if (!can.editSales(user, opp)) return { error: 'Bạn không có quyền sửa cơ hội này' }
  const parsed = await readOpportunity(fd)
  if ('error' in parsed) return { error: parsed.error }
  const data: Prisma.OpportunityUncheckedUpdateInput = { ...parsed.data }
  if (can.assignOwner(user)) data.ownerId = str(fd, 'ownerId') ?? user.id
  await prisma.opportunity.update({ where: { id }, data })
  await audit(prisma, { userId: user.id, action: 'SUA', entity: 'Opportunity', entityId: id })
  redirect(`/co-hoi/${id}`)
}

export async function markContacted(id: string): Promise<ActionState> {
  const user = await requireUser()
  const opp = await visibleOpportunity(user, id)
  if (!can.editSales(user, opp)) return { error: 'Bạn không có quyền' }
  await prisma.opportunity.updateMany({ where: { id, firstContactAt: null }, data: { firstContactAt: new Date() } })
  revalidatePath(`/co-hoi/${id}`)
  return { ok: 'Đã ghi nhận phản hồi khách' }
}

const MOVABLE: OpportunityStage[] = ['TIEP_NHAN', 'KHAO_SAT', 'BAO_GIA', 'DAM_PHAN']

export async function moveStage(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const opp = await visibleOpportunity(user, id)
  if (!can.editSales(user, opp)) return { error: 'Bạn không có quyền' }
  const stage = str(fd, 'stage') as OpportunityStage | null
  if (!stage || !MOVABLE.includes(stage)) return { error: 'Giai đoạn không hợp lệ. "Đã ký" được cập nhật khi hợp đồng được ký.' }
  if (opp.stage === 'THANG') return { error: 'Cơ hội đã ký hợp đồng' }
  await prisma.opportunity.update({ where: { id }, data: { stage, stageChangedAt: new Date(), closedAt: null, lostReason: null } })
  await audit(prisma, { userId: user.id, action: 'CHUYEN_GIAI_DOAN', entity: 'Opportunity', entityId: id, detail: stage })
  revalidatePath(`/co-hoi/${id}`)
  revalidatePath('/co-hoi')
  return { ok: 'Đã cập nhật giai đoạn' }
}

/** QT-KD-01 bước 6: ghi nhận lý do thắng/thua */
export async function markLost(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const opp = await visibleOpportunity(user, id)
  if (!can.editSales(user, opp)) return { error: 'Bạn không có quyền' }
  const reason = str(fd, 'reason')
  if (!reason) return { error: 'Nhập lý do không thành để rút kinh nghiệm' }
  if (opp.stage === 'THANG') return { error: 'Cơ hội đã ký hợp đồng' }
  const now = new Date()
  await prisma.$transaction([
    prisma.opportunity.update({ where: { id }, data: { stage: 'THUA', closedAt: now, lostReason: reason, stageChangedAt: now } }),
    prisma.quote.updateMany({ where: { opportunityId: id, status: { in: ['NHAP', 'CHO_DUYET', 'DA_DUYET', 'DA_GUI', 'TU_CHOI'] } }, data: { status: 'THUA', closedAt: now, lostReason: reason } }),
    prisma.activity.updateMany({ where: { opportunityId: id, doneAt: null, auto: true }, data: { doneAt: now, result: 'Đóng do cơ hội không thành' } }),
  ])
  await audit(prisma, { userId: user.id, action: 'KHONG_THANH', entity: 'Opportunity', entityId: id, detail: reason })
  revalidatePath(`/co-hoi/${id}`)
  return { ok: 'Đã đóng cơ hội' }
}

/** BM-KD-01 Phiếu khảo sát hiện trạng */
export async function saveSurvey(opportunityId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const opp = await visibleOpportunity(user, opportunityId)
  if (!can.survey(user)) return { error: 'Bạn không có quyền lập phiếu khảo sát' }
  const surveyDate = parseDateOnly(str(fd, 'surveyDate'))
  if (!surveyDate) return { error: 'Chọn ngày khảo sát' }
  const data = {
    surveyDate,
    surveyorId: str(fd, 'surveyorId') ?? user.id,
    location: str(fd, 'location'),
    needs: fd.getAll('needs').map(String),
    areaSize: str(fd, 'areaSize'),
    light: str(fd, 'light'),
    soilDrainage: str(fd, 'soilDrainage'),
    waterPower: str(fd, 'waterPower'),
    underground: str(fd, 'underground'),
    access: str(fd, 'access'),
    styleBudget: str(fd, 'styleBudget'),
    deadline: str(fd, 'deadline'),
    risks: str(fd, 'risks'),
    photosLink: str(fd, 'photosLink'),
  }
  const existing = await prisma.survey.findUnique({ where: { opportunityId } })
  const now = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.survey.upsert({ where: { opportunityId }, create: { ...data, opportunityId }, update: data })
    if (!existing) {
      await tx.activity.updateMany({ where: { opportunityId, type: 'KHAO_SAT', doneAt: null, auto: true }, data: { doneAt: now, result: 'Đã lập phiếu khảo sát' } })
      await tx.activity.create({
        data: { type: 'GUI_BAO_GIA', subject: 'Lập dự toán, gửi báo giá sau khảo sát', customerId: opp.customerId, opportunityId, assigneeId: opp.ownerId ?? user.id, dueAt: dateOnlyToInstant(quoteDeadline(surveyDate)), auto: true, createdById: user.id },
      })
      if (opp.stage === 'TIEP_NHAN') await tx.opportunity.update({ where: { id: opportunityId }, data: { stage: 'KHAO_SAT', stageChangedAt: now } })
    }
    await audit(tx, { userId: user.id, action: existing ? 'SUA_KHAO_SAT' : 'KHAO_SAT', entity: 'Opportunity', entityId: opportunityId })
  })
  revalidatePath(`/co-hoi/${opportunityId}`)
  return { ok: 'Đã lưu phiếu khảo sát' }
}
