import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { customerScope, seesAll } from '@/lib/permissions'
import { Card, PageHeader } from '@/components/ui'
import { ActivityList } from '@/components/activity-list'
import { addDays, dateOnlyToInstant, todayVN } from '@/lib/rules/dates'
import { cn } from '@/lib/cn'

export const metadata = { title: 'Việc cần làm' }

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ pham_vi?: string }> }) {
  const user = await requireUser()
  const { pham_vi } = await searchParams
  const all = pham_vi === 'tat-ca' && seesAll(user)
  const base: Prisma.ActivityWhereInput = all ? { customer: customerScope(user) } : { assigneeId: user.id }
  const today = todayVN()
  const startToday = dateOnlyToInstant(today)
  const startTomorrow = dateOnlyToInstant(addDays(today, 1))
  const include = { assignee: { select: { name: true } }, customer: { select: { name: true } } } as const

  const [overdue, dueToday, upcoming, done] = await Promise.all([
    prisma.activity.findMany({ where: { ...base, doneAt: null, dueAt: { lt: startToday } }, orderBy: { dueAt: 'asc' }, include }),
    prisma.activity.findMany({ where: { ...base, doneAt: null, dueAt: { gte: startToday, lt: startTomorrow } }, orderBy: { dueAt: 'asc' }, include }),
    prisma.activity.findMany({ where: { ...base, doneAt: null, dueAt: { gte: startTomorrow } }, orderBy: { dueAt: 'asc' }, take: 50, include }),
    prisma.activity.findMany({ where: { ...base, doneAt: { not: null }, dueAt: { not: null } }, orderBy: { doneAt: 'desc' }, take: 15, include }),
  ])

  return (
    <>
      <PageHeader
        title="Việc cần làm"
        description="Việc hẹn với khách, việc hệ thống tự tạo theo QT-KD-01 (khảo sát, báo giá, gọi lại, hỏi thăm sau bán, nhắc nợ)."
        actions={
          seesAll(user) && (
            <div className="flex rounded-xl border border-line bg-white p-1 text-sm">
              <Link href="/viec-can-lam" className={cn('rounded-lg px-3 py-1.5', !all && 'bg-brand-soft font-semibold text-brand')}>Của tôi</Link>
              <Link href="/viec-can-lam?pham_vi=tat-ca" className={cn('rounded-lg px-3 py-1.5', all && 'bg-brand-soft font-semibold text-brand')}>Cả công ty</Link>
            </div>
          )
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title={`Quá hạn (${overdue.length})`}>
          <ActivityList items={overdue} showCustomer />
        </Card>
        <Card title={`Hôm nay (${dueToday.length})`}>
          <ActivityList items={dueToday} showCustomer />
        </Card>
        <Card title={`Sắp tới (${upcoming.length})`}>
          <ActivityList items={upcoming} showCustomer />
        </Card>
        <Card title="Vừa hoàn thành">
          <ActivityList items={done} showCustomer />
        </Card>
      </div>
      <p className="mt-4 text-xs text-muted">Thêm việc mới tại trang chi tiết khách hàng hoặc cơ hội, mục &quot;Chăm sóc khách hàng&quot;.</p>
    </>
  )
}
