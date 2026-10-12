import type { ContractType } from '@prisma/client'
import { prisma } from '../db'
import type { SessionUser } from '../auth'
import { customerScope } from '../permissions'
import { salesPeople } from './access'

/** Loại hợp đồng mặc định theo mảng kinh doanh */
export const SEGMENT_CONTRACT_TYPE: Record<string, ContractType> = {
  BAN_LE: 'MUA_BAN',
  BAN_BUON: 'MUA_BAN',
  CHO_THUE: 'CHO_THUE',
  CHAM_SOC: 'CHAM_SOC',
  THI_CONG: 'THI_CONG',
  HA_TANG: 'THI_CONG',
  VSMT: 'VSMT',
}

/** Thời hạn thanh toán chuẩn theo Điều 6 Quy chế tài chính */
export const DEFAULT_TERM_DAYS: Record<ContractType, number> = { MUA_BAN: 15, CHO_THUE: 10, CHAM_SOC: 10, VSMT: 10, THI_CONG: 15 }

export async function contractFormOptions(user: SessionUser) {
  const [customers, segments, owners] = await Promise.all([
    prisma.customer.findMany({ where: customerScope(user), orderBy: { name: 'asc' }, select: { id: true, name: true, code: true } }),
    prisma.segment.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
    salesPeople(),
  ])
  return { customers: customers.map((c) => ({ id: c.id, label: `${c.name} (${c.code})` })), segments, owners }
}
