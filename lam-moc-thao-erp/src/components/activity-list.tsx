import type { Activity, User } from '@prisma/client'
import { ActionForm } from './action-form'
import { Badge } from './ui'
import { Input } from './form'
import { ACTIVITY_LABEL } from '@/lib/labels'
import { formatDateTime, formatInstantDate } from '@/lib/rules/dates'
import { completeActivity } from '@/app/(app)/khach-hang/actions'

type Row = Activity & { assignee: Pick<User, 'name'> | null; customer?: { name: string } }

export function ActivityList({ items, showCustomer }: { items: Row[]; showCustomer?: boolean }) {
  if (items.length === 0) return <p className="text-sm text-muted">Chưa có hoạt động.</p>
  const now = new Date()
  return (
    <ol className="space-y-4">
      {items.map((a) => {
        const open = !a.doneAt && a.dueAt
        const late = open && a.dueAt! < now
        return (
          <li key={a.id} className="relative border-l-2 border-line pl-4">
            <span className={`absolute -left-[5px] top-1.5 size-2 rounded-full ${open ? (late ? 'bg-red-500' : 'bg-gap') : 'bg-brand'}`} />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone={open ? (late ? 'red' : 'orange') : 'gray'}>{ACTIVITY_LABEL[a.type]}</Badge>
              <span className="font-semibold text-ink">{a.subject}</span>
              {a.auto && <Badge tone="indigo">Theo quy trình</Badge>}
            </div>
            {showCustomer && a.customer && <div className="text-xs text-muted">{a.customer.name}</div>}
            {a.content && <p className="mt-1 whitespace-pre-line text-sm text-zinc-700">{a.content}</p>}
            <div className="mt-1 text-xs text-muted">
              {open ? `Hạn ${formatInstantDate(a.dueAt)} · Giao cho ${a.assignee?.name ?? '-'}` : `${formatDateTime(a.doneAt ?? a.createdAt)} · ${a.assignee?.name ?? ''}`}
              {a.result && ` · Kết quả: ${a.result}`}
            </div>
            {open && (
              <div className="mt-2">
                <ActionForm action={completeActivity.bind(null, a.id)} submitLabel="Xong" size="sm" variant="secondary" inline>
                  <Input name="result" placeholder="Kết quả (không bắt buộc)" className="max-w-xs py-1.5" />
                </ActionForm>
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
