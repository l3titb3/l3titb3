import { addDays, addWorkingDays, officeMinutesBetween } from './dates'

/** QT-KD-01 bước 1: phản hồi khách trong 15 phút giờ hành chính */
export const FIRST_RESPONSE_MINUTES = 15

export function firstResponseLate(receivedAt: Date, firstContactAt: Date | null, now: Date): boolean {
  const end = firstContactAt ?? now
  return officeMinutesBetween(receivedAt, end) > FIRST_RESPONSE_MINUTES
}

/** QT-KD-01 bước 3, 4: khảo sát trong 02 ngày làm việc; lập báo giá trong 02 ngày làm việc */
export function surveyDeadline(receivedDate: Date): Date {
  return addWorkingDays(receivedDate, 2)
}

export function quoteDeadline(fromDate: Date): Date {
  return addWorkingDays(fromDate, 2)
}

/** QT-KD-01 bước 6: gọi lại sau 02 ngày kể từ khi gửi báo giá */
export function quoteCallbackDate(sentDate: Date): Date {
  return addWorkingDays(sentDate, 2)
}

/** QT-KD-01 bước 12: hỏi thăm sau 07 ngày, 30 ngày */
export function afterSalesDates(completedDate: Date): Date[] {
  return [addDays(completedDate, 7), addDays(completedDate, 30)]
}

/** QT-KD-01 bước 12: nhắc tái ký trước 30 ngày hết hạn */
export const RENEWAL_NOTICE_DAYS = 30

/** QT-KD-01 bước 11: nhắc nợ trước hạn 03 ngày */
export const DEBT_REMINDER_DAYS = 3

/** HĐ mẫu 03.1 Điều 4: tạm ứng trong 03 ngày làm việc kể từ ngày ký */
export function advanceDueDate(signDate: Date): Date {
  return addWorkingDays(signDate, 3)
}
