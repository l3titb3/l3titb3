/** Tiền VND luôn là số nguyên. Mọi phép tính tiền đi qua roundVnd. */
export function roundVnd(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value)
}

export function formatVnd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-'
  return roundVnd(value).toLocaleString('vi-VN')
}

/** Rút gọn cho thẻ số liệu: 1,25 tỷ; 350 triệu */
export function formatVndShort(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1e9) return `${sign}${trimNumber(abs / 1e9)} tỷ`
  if (abs >= 1e6) return `${sign}${trimNumber(abs / 1e6)} triệu`
  return formatVnd(value)
}

function trimNumber(n: number): string {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: n >= 100 ? 0 : 2 })
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-'
  return `${value.toLocaleString('vi-VN', { maximumFractionDigits: digits })}%`
}

/** Đọc số tiền bằng chữ, dùng cho Đề nghị thanh toán, Đối chiếu công nợ */
export function vndInWords(value: number): string {
  const n = roundVnd(Math.abs(value))
  if (n === 0) return 'Không đồng'
  const units = ['', ' nghìn', ' triệu', ' tỷ', ' nghìn tỷ', ' triệu tỷ']
  const groups: number[] = []
  let rest = n
  while (rest > 0) {
    groups.push(rest % 1000)
    rest = Math.floor(rest / 1000)
  }
  const parts: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i]
    if (g === 0) continue
    const isLeading = i === groups.length - 1
    parts.push(readThreeDigits(g, !isLeading) + units[i])
  }
  const text = parts.join(' ').replace(/\s+/g, ' ').trim()
  const sign = value < 0 ? 'Âm ' : ''
  const sentence = sign + text + ' đồng'
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']

function readThreeDigits(n: number, full: boolean): string {
  const hundreds = Math.floor(n / 100)
  const tens = Math.floor((n % 100) / 10)
  const ones = n % 10
  const words: string[] = []
  if (hundreds > 0 || full) {
    words.push(`${DIGITS[hundreds]} trăm`)
  }
  if (tens === 0) {
    if (ones > 0 && (hundreds > 0 || full)) words.push('linh')
  } else if (tens === 1) {
    words.push('mười')
  } else {
    words.push(`${DIGITS[tens]} mươi`)
  }
  if (ones > 0) {
    if (ones === 1 && tens > 1) words.push('mốt')
    else if (ones === 5 && tens > 0) words.push('lăm')
    else if (ones === 4 && tens > 1) words.push('tư')
    else words.push(DIGITS[ones])
  }
  return words.join(' ')
}
