'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { audit } from '@/lib/audit'
import { roundVnd } from '@/lib/rules/money'
import { num, str, type ActionState } from '@/lib/action'
import { PRODUCT_GROUPS } from '@/lib/labels'

function readProduct(fd: FormData) {
  const code = str(fd, 'code')?.toUpperCase().replace(/\s+/g, '')
  const name = str(fd, 'name')
  const group = str(fd, 'group')
  const unit = str(fd, 'unit')
  const costPrice = num(fd, 'costPrice') ?? 0
  const listPrice = num(fd, 'listPrice') ?? 0
  const rentPrice = num(fd, 'rentPrice')
  const minStock = num(fd, 'minStock')
  if (!code || !/^[A-Z0-9-]{2,30}$/.test(code)) return { error: 'Mã hàng gồm chữ in hoa, số, dấu gạch (ví dụ CC-KT35)' }
  if (!name) return { error: 'Nhập tên hàng' }
  if (!group || !(group in PRODUCT_GROUPS)) return { error: 'Chọn nhóm hàng' }
  if (!unit) return { error: 'Nhập đơn vị tính' }
  if (costPrice < 0 || listPrice < 0 || (rentPrice ?? 0) < 0) return { error: 'Giá không được âm' }
  return { data: { code, name, group, unit, spec: str(fd, 'spec'), costPrice: roundVnd(costPrice), listPrice: roundVnd(listPrice), rentPrice: rentPrice === null ? null : roundVnd(rentPrice), minStock, note: str(fd, 'note') } }
}

export async function saveProduct(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  if (!can.manageProducts(user)) return { error: 'Bạn không có quyền sửa danh mục hàng hóa' }
  const parsed = readProduct(fd)
  if ('error' in parsed) return { error: parsed.error }
  const dup = await prisma.product.findFirst({ where: { code: parsed.data.code, ...(id ? { id: { not: id } } : {}) } })
  if (dup) return { error: `Mã ${parsed.data.code} đã dùng cho ${dup.name}` }
  if (id) {
    await prisma.product.update({ where: { id }, data: { ...parsed.data, active: fd.get('active') === 'on' } })
    await audit(prisma, { userId: user.id, action: 'SUA', entity: 'Product', entityId: id, detail: parsed.data.code })
    redirect('/danh-muc/hang-hoa')
  }
  const p = await prisma.product.create({ data: parsed.data })
  await audit(prisma, { userId: user.id, action: 'TAO', entity: 'Product', entityId: p.id, detail: p.code })
  revalidatePath('/danh-muc/hang-hoa')
  return { ok: `Đã thêm ${p.code}` }
}

export async function saveSegment(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  if (!can.manageSettings(user)) return { error: 'Chỉ Giám đốc điều chỉnh tham số mảng kinh doanh' }
  const min = num(fd, 'targetMarginMin')
  const max = num(fd, 'targetMarginMax')
  const floor = num(fd, 'floorMargin')
  for (const v of [min, max, floor, num(fd, 'contributionFloor'), num(fd, 'bonusRate')]) {
    if (v !== null && (v < 0 || v >= 100)) return { error: 'Tỷ lệ phải từ 0 đến dưới 100%' }
  }
  if (min !== null && max !== null && min > max) return { error: 'Biên mục tiêu: cận dưới phải nhỏ hơn cận trên' }
  if (floor !== null && min !== null && floor > min) return { error: 'Mức sàn không được cao hơn biên mục tiêu' }
  await prisma.segment.update({
    where: { id },
    data: {
      name: str(fd, 'name') ?? undefined,
      targetMarginMin: min,
      targetMarginMax: max,
      floorMargin: floor,
      projectCodeMinValue: num(fd, 'projectCodeMinValue'),
      contributionFloor: num(fd, 'contributionFloor'),
      bonusRate: num(fd, 'bonusRate'),
      note: str(fd, 'note'),
    },
  })
  await audit(prisma, { userId: user.id, action: 'SUA', entity: 'Segment', entityId: id })
  revalidatePath('/danh-muc/mang-kinh-doanh')
  return { ok: 'Đã lưu' }
}
