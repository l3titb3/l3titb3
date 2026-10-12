import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type Tone = 'green' | 'indigo' | 'orange' | 'red' | 'gray' | 'amber' | 'blue'

const TONES: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  indigo: 'bg-brand-soft text-brand ring-brand/15',
  orange: 'bg-orange-50 text-orange-700 ring-orange-600/15',
  red: 'bg-red-50 text-red-700 ring-red-600/15',
  gray: 'bg-zinc-100 text-zinc-700 ring-zinc-500/15',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/15',
}

export function Badge({ tone = 'gray', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', TONES[tone], className)}>
      {children}
    </span>
  )
}

export function PageHeader({ title, description, actions, back }: { title: string; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-1 inline-block text-sm text-muted hover:text-brand">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {description && <div className="mt-1 text-sm text-muted">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ title, badge, actions, children, className, bodyClassName }: { title?: ReactNode; badge?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn('rounded-2xl border border-line bg-white', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex items-center gap-3">
            {title && <h2 className="text-base font-bold text-ink">{title}</h2>}
            {badge}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('px-5 py-4', bodyClassName)}>{children}</div>
    </section>
  )
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'warn' | 'bad' | 'good' }) {
  const color = tone === 'bad' ? 'text-red-700' : tone === 'warn' ? 'text-gap' : tone === 'good' ? 'text-emerald-700' : 'text-ink'
  return (
    <div className="rounded-2xl border border-line bg-white px-5 py-4">
      <div className="text-sm text-muted">{label}</div>
      <div className={cn('num mt-1 text-2xl font-bold tracking-tight', color)}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  )
}

export type BarItem = { label: ReactNode; value: number; display?: ReactNode; gap?: boolean; href?: string }

/** Thanh ngang như màn hình Báo cáo: màu cam cho phần dữ liệu còn thiếu */
export function BarList({ items, emptyText = 'Chưa có dữ liệu' }: { items: BarItem[]; emptyText?: string }) {
  const max = Math.max(0, ...items.map((i) => i.value))
  if (items.length === 0 || max === 0) return <p className="py-2 text-sm text-muted">{emptyText}</p>
  return (
    <ul className="space-y-3">
      {items.map((item, i) => {
        const pct = max > 0 ? Math.max(item.value > 0 ? 2 : 0, (item.value / max) * 100) : 0
        const label = item.href ? (
          <Link href={item.href} className="hover:text-brand">
            {item.label}
          </Link>
        ) : (
          item.label
        )
        return (
          <li key={i} className="grid grid-cols-[minmax(7rem,42%)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(9rem,40%)_1fr_auto]">
            <span className="leading-snug text-ink">{label}</span>
            <span className="h-2.5 rounded-full bg-zinc-100">
              <span className={cn('block h-2.5 rounded-full', item.gap ? 'bg-gap' : 'bg-brand')} style={{ width: `${pct}%` }} />
            </span>
            <span className="num min-w-14 text-right text-muted">{item.display ?? item.value}</span>
          </li>
        )
      })}
    </ul>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  )
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  )
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn('border-b border-line px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted', className)}>{children}</th>
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn('border-b border-line/70 px-5 py-3 align-top', className)}>{children}</td>
}

export function ButtonLink({ href, children, variant = 'primary' }: { href: string; children: ReactNode; variant?: 'primary' | 'secondary' }) {
  return (
    <Link href={href} className={buttonClass(variant)}>
      {children}
    </Link>
  )
}

export function buttonClass(variant: 'primary' | 'secondary' | 'danger' | 'ghost' = 'primary', size: 'md' | 'sm' = 'md'): string {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-60'
  const sizes = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
  const variants = {
    primary: 'bg-brand text-white hover:bg-indigo-800',
    secondary: 'border border-line bg-white text-ink hover:bg-zinc-50',
    danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
    ghost: 'text-brand hover:bg-brand-soft',
  }
  return cn(base, sizes, variants[variant])
}

export function DescList({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs text-muted">{k}</dt>
          <dd className="mt-0.5 break-words text-ink">{v === null || v === undefined || v === '' ? <span className="text-gap">Chưa ghi</span> : v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Notice({ tone = 'amber', children }: { tone?: 'amber' | 'red' | 'indigo' | 'green'; children: ReactNode }) {
  const styles = {
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    red: 'border-red-200 bg-red-50 text-red-900',
    indigo: 'border-indigo-200 bg-brand-soft text-indigo-950',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  }
  return <div className={cn('rounded-xl border px-4 py-3 text-sm', styles[tone])}>{children}</div>
}

/** Nhãn nguồn số liệu như màn hình mẫu: "Số thật" khi lấy từ dữ liệu đang vận hành */
export function DataBadge({ demo }: { demo: boolean }) {
  return demo ? <Badge tone="amber">Dữ liệu mẫu</Badge> : <Badge tone="green">Số thật</Badge>
}

export function RuleBadge({ children = 'Theo quy chế' }: { children?: ReactNode }) {
  return <Badge tone="indigo">{children}</Badge>
}
