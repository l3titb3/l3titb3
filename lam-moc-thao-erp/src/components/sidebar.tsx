'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Building2,
  Calculator,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Factory,
  FileSignature,
  FileText,
  GraduationCap,
  KeyRound,
  Layers,
  LayoutGrid,
  Leaf,
  LogOut,
  Menu,
  Package,
  Target,
  UserCog,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { logout } from '@/lib/session-actions'

type NavItem = { href: string; label: string; icon: LucideIcon; count?: number; hidden?: boolean }
type NavGroup = { title: string; items: NavItem[] }

export type NavCounts = { tasks: number; quotes: number; contracts: number; overdue: number }

export function Sidebar({ user, counts, isDirector }: { user: { name: string; title: string }; counts: NavCounts; isDirector: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const groups: NavGroup[] = [
    {
      title: 'Tổng quan',
      items: [
        { href: '/', label: 'Tổng quan', icon: LayoutGrid },
        { href: '/viec-can-lam', label: 'Việc cần làm', icon: ClipboardList, count: counts.tasks },
      ],
    },
    {
      title: 'Khách hàng & CRM',
      items: [
        { href: '/khach-hang', label: 'Khách hàng', icon: Users },
        { href: '/co-hoi', label: 'Cơ hội bán hàng', icon: Target },
      ],
    },
    {
      title: 'Đơn hàng & Hợp đồng',
      items: [
        { href: '/bao-gia', label: 'Báo giá', icon: FileText, count: counts.quotes },
        { href: '/hop-dong', label: 'Hợp đồng', icon: FileSignature, count: counts.contracts },
        { href: '/cong-no', label: 'Công nợ phải thu', icon: Wallet, count: counts.overdue },
      ],
    },
    {
      title: 'Danh mục & Thiết lập',
      items: [
        { href: '/danh-muc/hang-hoa', label: 'Hàng hóa - dịch vụ', icon: Package },
        { href: '/danh-muc/mang-kinh-doanh', label: 'Mảng kinh doanh', icon: Layers },
        { href: '/thiet-lap/nguoi-dung', label: 'Người dùng', icon: UserCog, hidden: !isDirector },
        { href: '/thiet-lap/cong-ty', label: 'Thông tin công ty', icon: Building2 },
      ],
    },
  ]

  const later = [
    { label: 'Hành chính nhân sự', icon: UserCog, phase: 'GĐ 2' },
    { label: 'Sản xuất & Kho', icon: Factory, phase: 'GĐ 3' },
    { label: 'Tài chính & Kế toán', icon: Calculator, phase: 'GĐ 3' },
    { label: 'Công việc & Đào tạo', icon: GraduationCap, phase: 'GĐ 3' },
  ]

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/'))

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
        <span className="grid size-9 place-items-center rounded-xl bg-leaf text-white">
          <Leaf className="size-5" />
        </span>
        <div className="leading-tight">
          <div className="text-sm font-bold text-ink">Lâm Mộc Thảo</div>
          <div className="text-xs text-muted">Quản trị doanh nghiệp</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((g) => {
          const isCollapsed = collapsed[g.title]
          return (
            <div key={g.title} className="mb-2">
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [g.title]: !c[g.title] }))}
                className="flex w-full items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-zinc-600 hover:text-ink"
              >
                {g.title}
                {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </button>
              {!isCollapsed && (
                <ul className="space-y-0.5">
                  {g.items
                    .filter((i) => !i.hidden)
                    .map((item) => {
                      const Icon = item.icon
                      const active = isActive(item.href)
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition',
                              active ? 'bg-brand-soft font-semibold text-brand' : 'text-zinc-700 hover:bg-zinc-50',
                            )}
                          >
                            <Icon className="size-5 shrink-0" strokeWidth={1.75} />
                            <span className="flex-1">{item.label}</span>
                            {!!item.count && (
                              <span className="num rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">{item.count}</span>
                            )}
                          </Link>
                        </li>
                      )
                    })}
                </ul>
              )}
            </div>
          )
        })}
        <div className="mb-2">
          <div className="px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-zinc-400">Giai đoạn sau</div>
          <ul className="space-y-0.5">
            {later.map((m) => {
              const Icon = m.icon
              return (
                <li key={m.label} className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2 text-[15px] text-zinc-400" title="Chưa triển khai">
                  <Icon className="size-5 shrink-0" strokeWidth={1.75} />
                  <span className="flex-1">{m.label}</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">{m.phase}</span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
      <div className="border-t border-line px-4 py-3">
        <div className="mb-2 px-1">
          <div className="truncate text-sm font-semibold text-ink">{user.name}</div>
          <div className="truncate text-xs text-muted">{user.title}</div>
        </div>
        <div className="flex gap-1">
          <Link href="/doi-mat-khau" className="flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50">
            <KeyRound className="size-4" /> Đổi mật khẩu
          </Link>
          <form action={logout}>
            <button type="submit" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50">
              <LogOut className="size-4" /> Đăng xuất
            </button>
          </form>
        </div>
      </div>
    </nav>
  )

  return (
    <>
      <div className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-leaf text-white">
            <Leaf className="size-4" />
          </span>
          <span className="text-sm font-bold">Lâm Mộc Thảo</span>
        </div>
        <button type="button" aria-label="Mở menu" onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-zinc-100">
          <Menu className="size-5" />
        </button>
      </div>
      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-white shadow-xl">
            <button type="button" aria-label="Đóng menu" onClick={() => setOpen(false)} className="absolute right-3 top-5 rounded-lg p-2 hover:bg-zinc-100">
              <X className="size-5" />
            </button>
            {nav}
          </div>
        </div>
      )}
      <aside className="no-print sticky top-0 hidden h-screen w-72 shrink-0 border-r border-line bg-white lg:block">{nav}</aside>
    </>
  )
}
