import type { ContractType, CustomerType, Role, SignerLevel } from '@prisma/client'

export type ApprovalSettings = {
  quoteGdThreshold: number
  pgdSignLimit: number
  gdSignLimit: number
  pgdCreditLimit: number
}

export type Approver = { id: string; role: Role; isChairman: boolean }

/**
 * QT-KD-01 bước 5 và Điều 9 Quy chế tổ chức:
 * - PGĐ Kinh doanh duyệt báo giá theo bảng giá chuẩn, biên LN gộp từ mức sàn.
 * - Giám đốc duyệt khi biên dưới mức sàn hoặc giá trị từ 100 triệu đồng.
 * Giá trị so ngưỡng là tổng gồm VAT (cách tính thận trọng).
 */
export function quoteApprovalLevel(
  input: { total: number; grossMargin: number; floorMargin: number | null },
  settings: Pick<ApprovalSettings, 'quoteGdThreshold'>,
): { level: Extract<Role, 'PGD_KINH_DOANH' | 'GIAM_DOC'>; reasons: string[] } {
  const reasons: string[] = []
  if (input.floorMargin === null) {
    reasons.push('Mảng kinh doanh chưa có biên lợi nhuận sàn')
  } else if (input.grossMargin < input.floorMargin) {
    reasons.push(`Biên LN gộp ${input.grossMargin}% dưới mức sàn ${input.floorMargin}%`)
  }
  if (input.total >= settings.quoteGdThreshold) {
    reasons.push(`Giá trị từ ${(settings.quoteGdThreshold / 1e6).toLocaleString('vi-VN')} triệu đồng`)
  }
  return { level: reasons.length > 0 ? 'GIAM_DOC' : 'PGD_KINH_DOANH', reasons }
}

export function canApproveQuote(user: Approver, level: Role | null): boolean {
  if (user.role === 'GIAM_DOC') return true
  return level === 'PGD_KINH_DOANH' && user.role === 'PGD_KINH_DOANH'
}

/** Loại hợp đồng PGĐ Kinh doanh được ký theo GUQ 02/2026 (bán hàng, cho thuê, dịch vụ) */
const PGD_SIGNABLE: ContractType[] = ['MUA_BAN', 'CHO_THUE', 'CHAM_SOC', 'VSMT']

/**
 * Điều 9 Quy chế tổ chức - ma trận phê duyệt hợp đồng:
 * - Bán hàng, cho thuê, dịch vụ dưới 200 triệu: PGĐ Kinh doanh phê duyệt, ký (GUQ 02/2026).
 * - Từ 200 đến dưới 500 triệu (và hợp đồng thi công dưới 500 triệu): Giám đốc phê duyệt, ký (GUQ 01/2026).
 * - Từ 500 triệu: Giám đốc đề xuất, ký; Chủ tịch HĐTV phê duyệt.
 */
export function contractSignerLevel(type: ContractType, total: number, settings: Pick<ApprovalSettings, 'pgdSignLimit' | 'gdSignLimit'>): SignerLevel {
  if (total >= settings.gdSignLimit) return 'CHU_TICH'
  if (total < settings.pgdSignLimit && PGD_SIGNABLE.includes(type)) return 'PGD_KINH_DOANH'
  return 'GIAM_DOC'
}

export const SIGNER_BASIS: Record<SignerLevel, string> = {
  PGD_KINH_DOANH: 'PGĐ Kinh doanh phê duyệt, ký theo Giấy ủy quyền 02/2026/GUQ-LMT',
  GIAM_DOC: 'Giám đốc phê duyệt, ký theo Giấy ủy quyền 01/2026/GUQ-LMT',
  CHU_TICH: 'Giám đốc đề xuất, ký; Chủ tịch HĐTV phê duyệt',
}

export type ContractApprovalStep = 'PROPOSE' | 'APPROVE'

/** Bước tiếp theo người dùng có thể làm với hợp đồng đang chờ duyệt */
export function contractApprovalStep(
  user: Approver,
  contract: { signerLevel: SignerLevel; proposedAt: Date | null },
): ContractApprovalStep | null {
  switch (contract.signerLevel) {
    case 'PGD_KINH_DOANH':
      return user.role === 'PGD_KINH_DOANH' || user.role === 'GIAM_DOC' ? 'APPROVE' : null
    case 'GIAM_DOC':
      return user.role === 'GIAM_DOC' ? 'APPROVE' : null
    case 'CHU_TICH':
      if (!contract.proposedAt) return user.role === 'GIAM_DOC' ? 'PROPOSE' : null
      return user.isChairman ? 'APPROVE' : null
  }
}

/**
 * Điều 6 Quy chế tài chính - chính sách công nợ:
 * Khách lẻ không cho nợ. Khách tổ chức: PGĐ Kinh doanh duyệt đến 30 triệu đồng, vượt mức: Giám đốc.
 */
export function creditLimitError(
  user: Approver,
  customerType: CustomerType,
  creditLimit: number,
  settings: Pick<ApprovalSettings, 'pgdCreditLimit'>,
): string | null {
  if (creditLimit < 0) return 'Hạn mức nợ không được âm'
  if (creditLimit === 0) return null
  if (customerType === 'CA_NHAN') return 'Khách lẻ thanh toán 100% khi giao hàng, không cho nợ'
  if (user.role === 'GIAM_DOC') return null
  if (user.role === 'PGD_KINH_DOANH') {
    return creditLimit <= settings.pgdCreditLimit
      ? null
      : `PGĐ Kinh doanh chỉ duyệt hạn mức nợ đến ${(settings.pgdCreditLimit / 1e6).toLocaleString('vi-VN')} triệu đồng; vượt mức do Giám đốc duyệt`
  }
  return 'Chỉ PGĐ Kinh doanh hoặc Giám đốc được duyệt hạn mức nợ'
}

/** Mã công trình cấp cho hợp đồng thuộc 06 mảng phân bổ lợi nhuận, đủ giá trị tối thiểu (Quy chế 05.1 Điều 4) */
export function needsProjectCode(segment: { allocatesProfit: boolean; projectCodeMinValue: number | null }, value: number): boolean {
  if (!segment.allocatesProfit) return false
  return value >= (segment.projectCodeMinValue ?? 0)
}
