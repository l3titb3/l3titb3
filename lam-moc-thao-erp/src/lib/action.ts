export type ActionState = { error?: string; ok?: string } | undefined

/** Đọc chuỗi từ FormData, bỏ khoảng trắng; chuỗi rỗng -> null */
export function str(fd: FormData, key: string): string | null {
  const v = fd.get(key)
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

/** Đọc số tiền / số lượng: chấp nhận "1.250.000" hoặc "1250000" hoặc "2,5" */
export function num(fd: FormData, key: string): number | null {
  const raw = str(fd, key)
  return parseNumber(raw)
}

export function parseNumber(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  let s = raw.replace(/\s|đ|VND/gi, '')
  if (s === '') return null
  // Kiểu Việt Nam: dấu chấm phân cách nghìn, dấu phẩy thập phân
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key)
  return v === 'on' || v === 'true' || v === '1'
}
