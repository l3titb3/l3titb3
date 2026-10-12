import type { OpportunityStage } from '@prisma/client'
import { firstResponseLate, quoteDeadline, surveyDeadline } from './rules/followups'
import { instantToDateOnly, todayVN } from './rules/dates'

export type SlaFlag = { label: string; tone: 'red' | 'orange' }

/** Cảnh báo chậm so với chuẩn thời gian của QT-KD-01 */
export function opportunitySla(
  o: { stage: OpportunityStage; needsSurvey: boolean; receivedAt: Date; firstContactAt: Date | null; survey: { surveyDate: Date } | null; quoteCount: number },
  now: Date = new Date(),
): SlaFlag[] {
  if (o.stage === 'THANG' || o.stage === 'THUA') return []
  const flags: SlaFlag[] = []
  const today = todayVN(now)
  if (!o.firstContactAt) {
    flags.push(firstResponseLate(o.receivedAt, null, now) ? { label: 'Quá 15 phút chưa phản hồi', tone: 'red' } : { label: 'Chưa phản hồi', tone: 'orange' })
  }
  const beforeQuote = (o.stage === 'TIEP_NHAN' || o.stage === 'KHAO_SAT') && o.quoteCount === 0
  if (beforeQuote && o.needsSurvey && !o.survey && today > surveyDeadline(instantToDateOnly(o.receivedAt))) {
    flags.push({ label: 'Quá hạn khảo sát 2 ngày', tone: 'red' })
  }
  if (beforeQuote) {
    const from = o.needsSurvey ? o.survey?.surveyDate : instantToDateOnly(o.receivedAt)
    if (from && today > quoteDeadline(from)) flags.push({ label: 'Quá hạn lập báo giá', tone: 'red' })
  }
  return flags
}
