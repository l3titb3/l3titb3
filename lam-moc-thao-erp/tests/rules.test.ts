import { describe, expect, it } from 'vitest'
import { formatVnd, roundVnd, vndInWords } from '@/lib/rules/money'
import { computeTotals, grossMarginPercent, priceFromCost } from '@/lib/rules/pricing'
import {
  addWorkingDays,
  officeMinutesBetween,
  parseDateOnly,
  todayVN,
} from '@/lib/rules/dates'
import {
  canApproveQuote,
  contractApprovalStep,
  contractSignerLevel,
  creditLimitError,
  needsProjectCode,
  quoteApprovalLevel,
} from '@/lib/rules/approval'
import { agingBucket, isDeliveryOnHold, summarizeAging } from '@/lib/rules/aging'
import { firstResponseLate } from '@/lib/rules/followups'
import {
  formatContractNumber,
  formatProjectCode,
  formatQuoteNumber,
} from '@/lib/rules/numbering'

const settings = {
  quoteGdThreshold: 100_000_000,
  pgdSignLimit: 200_000_000,
  gdSignLimit: 500_000_000,
  pgdCreditLimit: 30_000_000,
}
const d = (s: string) => parseDateOnly(s)!

describe('Tiền', () => {
  it('làm tròn và định dạng VND', () => {
    expect(roundVnd(1234.5)).toBe(1235)
    expect(formatVnd(194400000)).toBe('194.400.000')
  })

  it('đọc số tiền bằng chữ', () => {
    expect(vndInWords(0)).toBe('Không đồng')
    expect(vndInWords(15)).toBe('Mười lăm đồng')
    expect(vndInWords(21)).toBe('Hai mươi mốt đồng')
    expect(vndInWords(105)).toBe('Một trăm linh năm đồng')
    expect(vndInWords(1_005_000)).toBe('Một triệu không trăm linh năm nghìn đồng')
    expect(vndInWords(38_880_000)).toBe('Ba mươi tám triệu tám trăm tám mươi nghìn đồng')
    expect(vndInWords(194_400_000)).toBe('Một trăm chín mươi tư triệu bốn trăm nghìn đồng')
    expect(vndInWords(2_000_000_000)).toBe('Hai tỷ đồng')
  })
})

describe('Giá và biên lợi nhuận', () => {
  it('tính tổng báo giá, VAT và biên LN gộp', () => {
    const t = computeTotals(
      [
        { quantity: 12, unitPrice: 520_000, unitCost: 280_000 },
        { quantity: 150, unitPrice: 60_000, unitCost: 35_000 },
      ],
      8,
    )
    expect(t.subtotal).toBe(15_240_000)
    expect(t.vatAmount).toBe(1_219_200)
    expect(t.total).toBe(16_459_200)
    expect(t.costTotal).toBe(8_610_000)
    expect(t.grossMargin).toBe(43.5)
  })

  it('giá bán từ giá vốn theo QT-KD-01', () => {
    expect(priceFromCost(280_000, 45)).toBe(509_091)
    expect(grossMarginPercent(0, 100)).toBe(0)
  })
})

describe('Phê duyệt báo giá (QT-KD-01 bước 5)', () => {
  it('PGĐ Kinh doanh duyệt khi đạt mức sàn và dưới 100 triệu', () => {
    const r = quoteApprovalLevel({ total: 50_000_000, grossMargin: 32, floorMargin: 30 }, settings)
    expect(r.level).toBe('PGD_KINH_DOANH')
    expect(r.reasons).toHaveLength(0)
  })

  it('Giám đốc duyệt khi dưới mức sàn', () => {
    const r = quoteApprovalLevel({ total: 50_000_000, grossMargin: 25, floorMargin: 30 }, settings)
    expect(r.level).toBe('GIAM_DOC')
  })

  it('Giám đốc duyệt khi từ 100 triệu', () => {
    expect(quoteApprovalLevel({ total: 100_000_000, grossMargin: 40, floorMargin: 30 }, settings).level).toBe('GIAM_DOC')
  })

  it('Giám đốc duyệt khi mảng chưa có mức sàn', () => {
    expect(quoteApprovalLevel({ total: 5_000_000, grossMargin: 60, floorMargin: null }, settings).level).toBe('GIAM_DOC')
  })

  it('quyền duyệt theo vai trò', () => {
    const pgd = { id: 'a', role: 'PGD_KINH_DOANH' as const, isChairman: false }
    const gd = { id: 'b', role: 'GIAM_DOC' as const, isChairman: false }
    const nv = { id: 'c', role: 'NV_KINH_DOANH' as const, isChairman: false }
    expect(canApproveQuote(pgd, 'PGD_KINH_DOANH')).toBe(true)
    expect(canApproveQuote(pgd, 'GIAM_DOC')).toBe(false)
    expect(canApproveQuote(gd, 'GIAM_DOC')).toBe(true)
    expect(canApproveQuote(nv, 'PGD_KINH_DOANH')).toBe(false)
  })
})

describe('Ký hợp đồng (Điều 9 Quy chế tổ chức)', () => {
  it('xác định cấp ký theo loại và giá trị', () => {
    expect(contractSignerLevel('MUA_BAN', 199_999_999, settings)).toBe('PGD_KINH_DOANH')
    expect(contractSignerLevel('MUA_BAN', 200_000_000, settings)).toBe('GIAM_DOC')
    expect(contractSignerLevel('THI_CONG', 150_000_000, settings)).toBe('GIAM_DOC')
    expect(contractSignerLevel('CHO_THUE', 499_000_000, settings)).toBe('GIAM_DOC')
    expect(contractSignerLevel('CHAM_SOC', 500_000_000, settings)).toBe('CHU_TICH')
  })

  it('hợp đồng từ 500 triệu: Giám đốc đề xuất rồi Chủ tịch HĐTV phê duyệt', () => {
    const gd = { id: 'gd', role: 'GIAM_DOC' as const, isChairman: false }
    const ct = { id: 'ct', role: 'PGD_KY_THUAT' as const, isChairman: true }
    expect(contractApprovalStep(gd, { signerLevel: 'CHU_TICH', proposedAt: null })).toBe('PROPOSE')
    expect(contractApprovalStep(ct, { signerLevel: 'CHU_TICH', proposedAt: null })).toBeNull()
    expect(contractApprovalStep(ct, { signerLevel: 'CHU_TICH', proposedAt: new Date() })).toBe('APPROVE')
    expect(contractApprovalStep(gd, { signerLevel: 'CHU_TICH', proposedAt: new Date() })).toBeNull()
    expect(contractApprovalStep(ct, { signerLevel: 'GIAM_DOC', proposedAt: null })).toBeNull()
  })

  it('cấp mã công trình theo mảng và giá trị', () => {
    expect(needsProjectCode({ allocatesProfit: true, projectCodeMinValue: 20_000_000 }, 20_000_000)).toBe(true)
    expect(needsProjectCode({ allocatesProfit: true, projectCodeMinValue: 50_000_000 }, 40_000_000)).toBe(false)
    expect(needsProjectCode({ allocatesProfit: false, projectCodeMinValue: null }, 90_000_000)).toBe(false)
  })
})

describe('Hạn mức nợ (Điều 6 Quy chế tài chính)', () => {
  const pgd = { id: 'a', role: 'PGD_KINH_DOANH' as const, isChairman: false }
  const gd = { id: 'b', role: 'GIAM_DOC' as const, isChairman: false }
  it('khách lẻ không cho nợ', () => {
    expect(creditLimitError(gd, 'CA_NHAN', 1_000_000, settings)).not.toBeNull()
  })
  it('PGĐ Kinh doanh duyệt đến 30 triệu', () => {
    expect(creditLimitError(pgd, 'TO_CHUC', 30_000_000, settings)).toBeNull()
    expect(creditLimitError(pgd, 'TO_CHUC', 30_000_001, settings)).not.toBeNull()
    expect(creditLimitError(gd, 'TO_CHUC', 80_000_000, settings)).toBeNull()
  })
})

describe('Tuổi nợ (file 04.3, sheet Cong no)', () => {
  const asOf = d('2026-11-30')
  const rows = [
    { amount: 194_400_000, paidAmount: 194_400_000, dueDate: d('2026-10-15') },
    { amount: 38_880_000, paidAmount: 0, dueDate: d('2026-11-10') },
    { amount: 48_600_000, paidAmount: 32_400_000, dueDate: d('2026-11-10') },
    { amount: 64_800_000, paidAmount: 0, dueDate: d('2026-12-05') },
  ]

  it('khớp số liệu ví dụ trong file Excel', () => {
    expect(agingBucket(rows[0], asOf)).toBe('DA_THU_DU')
    expect(agingBucket(rows[1], asOf)).toBe('QH_1_30')
    const s = summarizeAging(rows, asOf)
    expect(s.totalOutstanding).toBe(119_880_000)
    expect(s.TRONG_HAN).toBe(64_800_000)
    expect(s.QH_1_30).toBe(55_080_000)
    expect(s.over30).toBe(0)
    expect(s.over30Ratio).toBe(0)
  })

  it('tạm dừng giao hàng khi quá hạn trên 30 ngày', () => {
    expect(isDeliveryOnHold(rows, asOf)).toBe(false)
    expect(isDeliveryOnHold(rows, d('2026-12-11'))).toBe(true)
  })
})

describe('Ngày làm việc và giờ hành chính', () => {
  it('bỏ qua Chủ nhật khi cộng ngày làm việc', () => {
    // 10/10/2026 là Thứ Bảy -> +2 ngày làm việc = Thứ Ba 13/10
    expect(addWorkingDays(d('2026-10-10'), 2).toISOString().slice(0, 10)).toBe('2026-10-13')
  })

  it('đếm phút giờ hành chính theo giờ Việt Nam', () => {
    // Thứ Hai 12/10/2026 11:20 -> 13:40 giờ VN: 10 phút buổi sáng + 10 phút buổi chiều
    const start = new Date('2026-10-12T04:20:00Z')
    const end = new Date('2026-10-12T06:40:00Z')
    expect(officeMinutesBetween(start, end)).toBe(20)
  })

  it('khách nhắn ngoài giờ không tính trễ cho đến giờ làm việc', () => {
    // Chủ nhật 11/10/2026 20:00 giờ VN, phản hồi Thứ Hai 07:40
    const received = new Date('2026-10-11T13:00:00Z')
    const contact = new Date('2026-10-12T00:40:00Z')
    expect(firstResponseLate(received, contact, contact)).toBe(false)
  })

  it('ngày hôm nay theo giờ Việt Nam', () => {
    expect(todayVN(new Date('2026-10-12T18:30:00Z')).toISOString().slice(0, 10)).toBe('2026-10-13')
  })
})

describe('Đánh số chứng từ', () => {
  it('theo mẫu biểu của công ty', () => {
    expect(formatQuoteNumber(7, 2026)).toBe('007/2026/BG-LMT')
    expect(formatContractNumber('MUA_BAN', 12, 2026, 'KH-0003')).toBe('012/2026/HĐMB/LMT-KH0003')
    expect(formatProjectCode(1, 2026)).toBe('CT-2026-001')
  })
})
