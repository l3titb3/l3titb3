'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import type { Role } from '@prisma/client'
import { prisma } from '@/lib/db'
import { hashPassword, requireUser } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { audit } from '@/lib/audit'
import { num, str, type ActionState } from '@/lib/action'
import { ROLE_LABEL } from '@/lib/labels'

const ROLES = Object.keys(ROLE_LABEL) as Role[]

function tempPassword(): string {
  return randomBytes(6).toString('base64url')
}

async function requireDirector() {
  const user = await requireUser()
  if (!can.manageSettings(user)) throw new Error('Chỉ Giám đốc quản lý người dùng và thiết lập')
  return user
}

export async function createUser(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const director = await requireDirector()
  const email = str(fd, 'email')?.toLowerCase()
  const name = str(fd, 'name')
  const title = str(fd, 'title')
  const role = str(fd, 'role') as Role | null
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Email đăng nhập không hợp lệ' }
  if (!name || !title) return { error: 'Nhập họ tên và chức danh' }
  if (!role || !ROLES.includes(role)) return { error: 'Chọn vai trò' }
  if (await prisma.user.findUnique({ where: { email } })) return { error: 'Email đã được dùng' }
  const password = tempPassword()
  const u = await prisma.user.create({
    data: { email, name, title, role, phone: str(fd, 'phone'), isChairman: fd.get('isChairman') === 'on', passwordHash: await hashPassword(password), mustChangePassword: true },
  })
  await audit(prisma, { userId: director.id, action: 'TAO', entity: 'User', entityId: u.id, detail: email })
  revalidatePath('/thiet-lap/nguoi-dung')
  return { ok: `Đã tạo tài khoản. Mật khẩu tạm: ${password} (chỉ hiện một lần, người dùng đổi khi đăng nhập lần đầu)` }
}

export async function updateUser(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const director = await requireDirector()
  const name = str(fd, 'name')
  const title = str(fd, 'title')
  const email = str(fd, 'email')?.toLowerCase()
  const role = str(fd, 'role') as Role | null
  const active = fd.get('active') === 'on'
  if (!name || !title) return { error: 'Nhập họ tên và chức danh' }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Email đăng nhập không hợp lệ' }
  if (!role || !ROLES.includes(role)) return { error: 'Chọn vai trò' }
  if (id === director.id && (role !== 'GIAM_DOC' || !active)) return { error: 'Không tự bỏ vai trò Giám đốc hoặc tự khóa tài khoản của mình' }
  if (await prisma.user.findFirst({ where: { email, id: { not: id } } })) return { error: 'Email đã được dùng' }
  await prisma.user.update({ where: { id }, data: { name, title, email, role, active, phone: str(fd, 'phone'), isChairman: fd.get('isChairman') === 'on' } })
  if (!active) await prisma.session.deleteMany({ where: { userId: id } })
  await audit(prisma, { userId: director.id, action: 'SUA', entity: 'User', entityId: id })
  revalidatePath('/thiet-lap/nguoi-dung')
  return { ok: 'Đã lưu' }
}

export async function resetPassword(id: string): Promise<ActionState> {
  const director = await requireDirector()
  const password = tempPassword()
  await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(password), mustChangePassword: true, failedLogins: 0, lockedUntil: null } })
  await prisma.session.deleteMany({ where: { userId: id } })
  await audit(prisma, { userId: director.id, action: 'CAP_LAI_MAT_KHAU', entity: 'User', entityId: id })
  return { ok: `Mật khẩu tạm mới: ${password} (chỉ hiện một lần)` }
}

export async function saveCompany(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const director = await requireDirector()
  const required = ['name', 'taxCode', 'address', 'phone', 'email', 'legalRep', 'legalRepTitle', 'director'] as const
  const data: Record<string, string | null> = {}
  for (const k of required) {
    const v = str(fd, k)
    if (!v) return { error: 'Điền đủ thông tin doanh nghiệp' }
    data[k] = v
  }
  const numbers = {
    defaultVatRate: num(fd, 'defaultVatRate'),
    quoteGdThreshold: num(fd, 'quoteGdThreshold'),
    pgdSignLimit: num(fd, 'pgdSignLimit'),
    gdSignLimit: num(fd, 'gdSignLimit'),
    pgdCreditLimit: num(fd, 'pgdCreditLimit'),
    overdueRatioLimit: num(fd, 'overdueRatioLimit'),
    quoteValidDays: num(fd, 'quoteValidDays'),
  }
  if (Object.values(numbers).some((v) => v === null || v < 0)) return { error: 'Tham số phải là số không âm' }
  if (numbers.pgdSignLimit! >= numbers.gdSignLimit!) return { error: 'Hạn mức ký của PGĐ phải nhỏ hơn hạn mức của Giám đốc' }
  await prisma.companySetting.update({
    where: { id: 1 },
    data: {
      ...(data as Record<(typeof required)[number], string>),
      bankAccount: str(fd, 'bankAccount'),
      bankName: str(fd, 'bankName'),
      defaultVatRate: numbers.defaultVatRate!,
      quoteGdThreshold: numbers.quoteGdThreshold!,
      pgdSignLimit: numbers.pgdSignLimit!,
      gdSignLimit: numbers.gdSignLimit!,
      pgdCreditLimit: numbers.pgdCreditLimit!,
      overdueRatioLimit: numbers.overdueRatioLimit!,
      quoteValidDays: Math.round(numbers.quoteValidDays!),
      demoData: fd.get('demoData') === 'on',
    },
  })
  await audit(prisma, { userId: director.id, action: 'SUA', entity: 'CompanySetting', entityId: '1' })
  revalidatePath('/', 'layout')
  return { ok: 'Đã lưu thông tin công ty và tham số' }
}
