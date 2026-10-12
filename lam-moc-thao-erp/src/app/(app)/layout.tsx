import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { requireUser } from '@/lib/auth'
import { getCompany } from '@/lib/settings'
import { navCounts } from '@/lib/queries/nav'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  if (user.mustChangePassword) redirect('/doi-mat-khau')
  const [company, counts] = await Promise.all([getCompany(), navCounts(user)])
  return (
    <div className="lg:flex">
      <Sidebar user={{ name: user.name, title: user.title }} counts={counts} isDirector={user.role === 'GIAM_DOC'} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        {company.demoData && (
          <div className="no-print mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
            Đang chạy với <b>dữ liệu mẫu</b> để làm quen. Số liệu khách hàng, báo giá, hợp đồng, công nợ dưới đây không phải số thật.
          </div>
        )}
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  )
}
