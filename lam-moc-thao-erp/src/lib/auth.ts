import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import bcrypt from 'bcryptjs'
import type { Role } from '@prisma/client'
import { prisma } from './db'

const COOKIE_NAME = 'lmt_session'
const SESSION_DAYS = 7
const MAX_FAILED_LOGINS = 5
const LOCK_MINUTES = 15
export const MIN_PASSWORD_LENGTH = 8

export type SessionUser = {
  id: string
  email: string
  name: string
  title: string
  role: Role
  isChairman: boolean
  mustChangePassword: boolean
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function cookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === 'false') return false
  return process.env.NODE_ENV === 'production'
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await prisma.session.create({ data: { id: hashToken(token), userId, expiresAt } })
  const jar = await cookies()
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(),
    path: '/',
    expires: expiresAt,
  })
}

export async function destroySession(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(COOKIE_NAME)?.value
  if (token) await prisma.session.deleteMany({ where: { id: hashToken(token) } })
  jar.delete(COOKIE_NAME)
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  if (!token) return null
  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: true },
  })
  if (!session || session.expiresAt < new Date() || !session.user.active) return null
  const u = session.user
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    title: u.title,
    role: u.role,
    isChairman: u.isChairman,
    mustChangePassword: u.mustChangePassword,
  }
})

/** Dùng trong trang và Server Action: chưa đăng nhập thì chuyển về trang đăng nhập */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/dang-nhap')
  return user
}

export class PermissionError extends Error {
  constructor(message = 'Bạn không có quyền thực hiện thao tác này') {
    super(message)
  }
}

export type LoginResult = { ok: true; userId: string } | { ok: false; error: string }

export async function checkLogin(email: string, password: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
  const generic = 'Email hoặc mật khẩu không đúng'
  if (!user || !user.active) return { ok: false, error: generic }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { ok: false, error: `Tài khoản tạm khóa do nhập sai nhiều lần. Thử lại sau ${LOCK_MINUTES} phút.` }
  }
  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    const failed = user.failedLogins + 1
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLogins: failed >= MAX_FAILED_LOGINS ? 0 : failed,
        lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
      },
    })
    return { ok: false, error: generic }
  }
  if (user.failedLogins > 0 || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } })
  }
  return { ok: true, userId: user.id }
}
