import type { Prisma, Role } from '@prisma/client'
import type { SessionUser } from './auth'

type U = Pick<SessionUser, 'id' | 'role' | 'isChairman'>

const is = (u: U, ...roles: Role[]) => roles.includes(u.role)

/** Nhân viên kinh doanh chỉ thấy khách hàng, giao dịch mình phụ trách và khách chưa giao người */
export function seesAll(u: U): boolean {
  return u.role !== 'NV_KINH_DOANH'
}

export function customerScope(u: U): Prisma.CustomerWhereInput {
  return seesAll(u) ? {} : { OR: [{ ownerId: u.id }, { ownerId: null }] }
}

export function opportunityScope(u: U): Prisma.OpportunityWhereInput {
  return seesAll(u) ? {} : { OR: [{ ownerId: u.id }, { ownerId: null }] }
}

export function quoteScope(u: U): Prisma.QuoteWhereInput {
  return seesAll(u) ? {} : { OR: [{ createdById: u.id }, { customer: { ownerId: u.id } }] }
}

export function contractScope(u: U): Prisma.ContractWhereInput {
  return seesAll(u) ? {} : { OR: [{ ownerId: u.id }, { createdById: u.id }] }
}

export function receivableScope(u: U): Prisma.ReceivableWhereInput {
  return seesAll(u) ? {} : { OR: [{ ownerId: u.id }, { customer: { ownerId: u.id } }] }
}

export const can = {
  /** Tạo khách hàng, cơ hội, báo giá, hợp đồng (Phòng KD và Giám đốc) */
  sell: (u: U) => is(u, 'GIAM_DOC', 'PGD_KINH_DOANH', 'NV_KINH_DOANH'),
  editCustomer: (u: U, c: { ownerId: string | null }) =>
    is(u, 'GIAM_DOC', 'PGD_KINH_DOANH', 'KE_TOAN') || (u.role === 'NV_KINH_DOANH' && (c.ownerId === u.id || c.ownerId === null)),
  /** Giao khách hàng, cơ hội cho nhân viên */
  assignOwner: (u: U) => is(u, 'GIAM_DOC', 'PGD_KINH_DOANH'),
  editSales: (u: U, rec: { ownerId?: string | null; createdById?: string }) =>
    is(u, 'GIAM_DOC', 'PGD_KINH_DOANH') ||
    (u.role === 'NV_KINH_DOANH' && (rec.ownerId === u.id || rec.createdById === u.id || rec.ownerId === null)),
  /** Khảo sát: Phòng KT cùng NVKD (QT-KD-01 bước 3) */
  survey: (u: U) => is(u, 'GIAM_DOC', 'PGD_KINH_DOANH', 'PGD_KY_THUAT', 'NV_KINH_DOANH'),
  manageProducts: (u: U) => is(u, 'GIAM_DOC', 'PGD_KINH_DOANH', 'PGD_KY_THUAT'),
  /** Phòng HCKT rà soát hình thức hợp đồng trước khi trình ký */
  reviewContract: (u: U) => is(u, 'GIAM_DOC', 'KE_TOAN'),
  /** Ghi hóa đơn, đợt thanh toán, phiếu thu: Phòng HCKT (Giám đốc trực tiếp phụ trách) */
  manageReceivables: (u: U) => is(u, 'GIAM_DOC', 'KE_TOAN'),
  manageSettings: (u: U) => is(u, 'GIAM_DOC'),
  /** Giám đốc chấp thuận triển khai khi chưa nhận tạm ứng */
  waiveAdvance: (u: U) => is(u, 'GIAM_DOC'),
}
