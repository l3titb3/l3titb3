import type { ContractType } from '@prisma/client'

const pad = (n: number, width: number) => String(n).padStart(width, '0')

/** BM-KD-02: Số ...../20...../BG-LMT */
export function formatQuoteNumber(seq: number, year: number): string {
  return `${pad(seq, 3)}/${year}/BG-LMT`
}

/** Ký hiệu hợp đồng theo bộ mẫu 03.1 - 03.4, 03.9 */
export const CONTRACT_CODES: Record<ContractType, string> = {
  MUA_BAN: 'HĐMB',
  CHO_THUE: 'HĐCT',
  THI_CONG: 'HĐTC',
  CHAM_SOC: 'HĐDV',
  VSMT: 'HĐMT',
}

/** Số ...../20...../HĐMB/LMT-<mã khách hàng> */
export function formatContractNumber(type: ContractType, seq: number, year: number, customerCode: string): string {
  return `${pad(seq, 3)}/${year}/${CONTRACT_CODES[type]}/LMT-${customerCode.replace(/-/g, '')}`
}

/** Quy chế phân bổ lợi nhuận Điều 4: mã công trình CT-YYYY-xxx */
export function formatProjectCode(seq: number, year: number): string {
  return `CT-${year}-${pad(seq, 3)}`
}

export function formatCustomerCode(seq: number): string {
  return `KH-${pad(seq, 4)}`
}

export function formatOpportunityCode(seq: number, year: number): string {
  return `CO-${year}-${pad(seq, 3)}`
}

export const COUNTER_KEYS = {
  customer: () => 'KH',
  opportunity: (year: number) => `CO-${year}`,
  quote: (year: number) => `BG-${year}`,
  contract: (type: ContractType, year: number) => `${CONTRACT_CODES[type]}-${year}`,
  project: (year: number) => `CT-${year}`,
}
