import { diffDays } from './dates'

export type AgingBucket = 'DA_THU_DU' | 'TRONG_HAN' | 'QH_1_30' | 'QH_31_60' | 'QH_61_90' | 'QH_TREN_90'

export const AGING_LABEL: Record<AgingBucket, string> = {
  DA_THU_DU: 'Đã thu đủ',
  TRONG_HAN: 'Trong hạn',
  QH_1_30: 'Quá hạn 1-30 ngày',
  QH_31_60: 'Quá hạn 31-60 ngày',
  QH_61_90: 'Quá hạn 61-90 ngày',
  QH_TREN_90: 'Quá hạn trên 90 ngày',
}

/** Biện pháp theo Điều 7 Quy chế tài chính */
export const AGING_ACTION: Partial<Record<AgingBucket, string>> = {
  QH_31_60: 'Tạm dừng giao hàng mới',
  QH_61_90: 'Gửi thông báo đòi nợ bằng văn bản; tạm dừng giao hàng',
  QH_TREN_90: 'Giám đốc quyết định biện pháp thu hồi',
}

export type ReceivableLike = { amount: number; paidAmount: number; dueDate: Date }

export function outstanding(r: Pick<ReceivableLike, 'amount' | 'paidAmount'>): number {
  return Math.max(0, r.amount - r.paidAmount)
}

export function daysOverdue(dueDate: Date, asOf: Date): number {
  return Math.max(0, diffDays(asOf, dueDate))
}

export function agingBucket(r: ReceivableLike, asOf: Date): AgingBucket {
  if (outstanding(r) <= 0) return 'DA_THU_DU'
  const days = daysOverdue(r.dueDate, asOf)
  if (days <= 0) return 'TRONG_HAN'
  if (days <= 30) return 'QH_1_30'
  if (days <= 60) return 'QH_31_60'
  if (days <= 90) return 'QH_61_90'
  return 'QH_TREN_90'
}

export type AgingSummary = Record<Exclude<AgingBucket, 'DA_THU_DU'>, number> & {
  totalOutstanding: number
  over30: number
  /** Tỷ lệ nợ quá hạn trên 30 ngày / tổng nợ phải thu (%) */
  over30Ratio: number
}

export function summarizeAging(items: ReceivableLike[], asOf: Date): AgingSummary {
  const s: AgingSummary = {
    TRONG_HAN: 0,
    QH_1_30: 0,
    QH_31_60: 0,
    QH_61_90: 0,
    QH_TREN_90: 0,
    totalOutstanding: 0,
    over30: 0,
    over30Ratio: 0,
  }
  for (const r of items) {
    const bucket = agingBucket(r, asOf)
    if (bucket === 'DA_THU_DU') continue
    const amount = outstanding(r)
    s[bucket] += amount
    s.totalOutstanding += amount
    if (bucket === 'QH_31_60' || bucket === 'QH_61_90' || bucket === 'QH_TREN_90') s.over30 += amount
  }
  s.over30Ratio = s.totalOutstanding > 0 ? Math.round((s.over30 / s.totalOutstanding) * 1000) / 10 : 0
  return s
}

/** Khách có nợ quá hạn trên 30 ngày thì tạm dừng giao hàng mới (Điều 7 Quy chế tài chính) */
export function isDeliveryOnHold(items: ReceivableLike[], asOf: Date): boolean {
  return items.some((r) => outstanding(r) > 0 && daysOverdue(r.dueDate, asOf) > 30)
}
