import type { ContractStatus, QuoteStatus } from '@prisma/client'
import type { Tone } from '@/components/ui'

export function quoteStatusTone(s: QuoteStatus): Tone {
  return ({ NHAP: 'gray', CHO_DUYET: 'amber', DA_DUYET: 'indigo', TU_CHOI: 'red', DA_GUI: 'blue', THANG: 'green', THUA: 'gray', HUY: 'gray' } as const)[s]
}

export function contractStatusTone(s: ContractStatus): Tone {
  return ({ SOAN_THAO: 'gray', CHO_DUYET: 'amber', DA_KY: 'green', HOAN_THANH: 'indigo', THANH_LY: 'gray', HUY: 'gray' } as const)[s]
}
