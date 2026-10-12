/**
 * Việt Nam dùng UTC+7, không có giờ mùa hè.
 * - Mốc thời gian (tạo lúc, phản hồi lúc...) lưu đúng thời điểm, hiển thị theo giờ Việt Nam.
 * - Ngày thuần (ngày hóa đơn, hạn thanh toán...) lưu ở 00:00 UTC của ngày đó.
 */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** Ngày hôm nay theo lịch Việt Nam, dạng ngày thuần */
export function todayVN(now: Date = new Date()): Date {
  const vn = new Date(now.getTime() + VN_OFFSET_MS)
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()))
}

/** 'YYYY-MM-DD' -> ngày thuần */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return Number.isNaN(d.getTime()) ? null : d
}

/** Ngày thuần -> 'YYYY-MM-DD' cho ô nhập liệu */
export function toInputDate(d: Date | null | undefined): string {
  if (!d) return ''
  return d.toISOString().slice(0, 10)
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS)
}

export function diffDays(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / DAY_MS)
}

/** Ngày nghỉ hằng tuần là Chủ nhật (Điều 6 Nội quy lao động) */
export function isWorkingDay(d: Date): boolean {
  return d.getUTCDay() !== 0
}

/** Cộng n ngày làm việc (bỏ qua Chủ nhật) cho ngày thuần */
export function addWorkingDays(d: Date, n: number): Date {
  let result = new Date(d.getTime())
  let added = 0
  while (added < n) {
    result = addDays(result, 1)
    if (isWorkingDay(result)) added++
  }
  return result
}

/**
 * Giờ hành chính khối văn phòng (Điều 3 Nội quy lao động):
 * Thứ Hai - Thứ Sáu 07h30-11h30, 13h30-17h30; Thứ Bảy 07h30-11h30.
 */
const OFFICE_SHIFTS: Record<number, Array<[number, number]>> = {
  1: [[450, 690], [810, 1050]],
  2: [[450, 690], [810, 1050]],
  3: [[450, 690], [810, 1050]],
  4: [[450, 690], [810, 1050]],
  5: [[450, 690], [810, 1050]],
  6: [[450, 690]],
}

/** Số phút giờ hành chính giữa hai thời điểm */
export function officeMinutesBetween(start: Date, end: Date): number {
  if (end <= start) return 0
  let total = 0
  const startVN = new Date(start.getTime() + VN_OFFSET_MS)
  const endVN = new Date(end.getTime() + VN_OFFSET_MS)
  let day = new Date(Date.UTC(startVN.getUTCFullYear(), startVN.getUTCMonth(), startVN.getUTCDate()))
  while (day <= endVN) {
    const shifts = OFFICE_SHIFTS[day.getUTCDay()] ?? []
    for (const [from, to] of shifts) {
      const shiftStart = day.getTime() + from * 60000
      const shiftEnd = day.getTime() + to * 60000
      const s = Math.max(shiftStart, startVN.getTime())
      const e = Math.min(shiftEnd, endVN.getTime())
      if (e > s) total += (e - s) / 60000
    }
    day = addDays(day, 1)
  }
  return Math.floor(total)
}

const dateFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const instantDateFmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/** Hiển thị ngày thuần: 05/10/2026 */
export function formatDate(d: Date | null | undefined): string {
  return d ? dateFmt.format(d) : '-'
}

/** Hiển thị mốc thời gian theo giờ Việt Nam: 05/10/2026 08:30 */
export function formatDateTime(d: Date | null | undefined): string {
  return d ? dateTimeFmt.format(d) : '-'
}

/** Ngày (theo giờ Việt Nam) của một mốc thời gian */
export function formatInstantDate(d: Date | null | undefined): string {
  return d ? instantDateFmt.format(d) : '-'
}

/** Ngày thuần (giờ VN) của một mốc thời gian */
export function instantToDateOnly(d: Date): Date {
  return todayVN(d)
}

export function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

export function startOfYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
}

/** Đổi ngày thuần sang mốc thời gian 00:00 giờ Việt Nam (để so với createdAt...) */
export function dateOnlyToInstant(d: Date): Date {
  return new Date(d.getTime() - VN_OFFSET_MS)
}
