'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from './db'
import { checkLogin, createSession, destroySession, getCurrentUser, hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from './auth'
import type { ActionState } from './action'
import { audit } from './audit'

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Nhập email'),
  password: z.string().min(1, 'Nhập mật khẩu'),
})

export async function login(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({ email: fd.get('email'), password: fd.get('password') })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const result = await checkLogin(parsed.data.email, parsed.data.password)
  if (!result.ok) return { error: result.error }
  await createSession(result.userId)
  await audit(prisma, { userId: result.userId, action: 'DANG_NHAP', entity: 'User', entityId: result.userId })
  const next = fd.get('next')
  redirect(typeof next === 'string' && /^\/(?![/\\])/.test(next) && !next.includes('\\') ? next : '/')
}

export async function logout(): Promise<void> {
  await destroySession()
  redirect('/dang-nhap')
}

export async function changePassword(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) redirect('/dang-nhap')
  const current = String(fd.get('current') ?? '')
  const next = String(fd.get('next') ?? '')
  const confirm = String(fd.get('confirm') ?? '')
  if (next.length < MIN_PASSWORD_LENGTH) return { error: `Mật khẩu mới tối thiểu ${MIN_PASSWORD_LENGTH} ký tự` }
  if (next !== confirm) return { error: 'Nhập lại mật khẩu mới không khớp' }
  if (next === current) return { error: 'Mật khẩu mới phải khác mật khẩu hiện tại' }
  const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
  if (!(await verifyPassword(current, record.passwordHash))) return { error: 'Mật khẩu hiện tại không đúng' }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next), mustChangePassword: false },
  })
  await audit(prisma, { userId: user.id, action: 'DOI_MAT_KHAU', entity: 'User', entityId: user.id })
  redirect('/')
}
