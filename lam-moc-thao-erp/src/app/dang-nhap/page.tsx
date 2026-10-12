import { redirect } from 'next/navigation'
import { Leaf } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { login } from '@/lib/session-actions'
import { ActionForm } from '@/components/action-form'
import { Field, Input } from '@/components/form'

export const metadata = { title: 'Đăng nhập' }
export const dynamic = 'force-dynamic'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect('/')
  const { next } = await searchParams
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-leaf text-white">
            <Leaf className="size-6" />
          </span>
          <div>
            <div className="text-lg font-bold">Công ty TNHH Lâm Mộc Thảo</div>
            <div className="text-sm text-muted">Phần mềm quản trị nội bộ</div>
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-white p-6">
          <h1 className="mb-4 text-xl font-bold">Đăng nhập</h1>
          <ActionForm action={login} submitLabel="Đăng nhập" pendingLabel="Đang đăng nhập...">
            <input type="hidden" name="next" value={next ?? ''} />
            <Field label="Email">
              <Input name="email" type="email" autoComplete="username" required autoFocus />
            </Field>
            <Field label="Mật khẩu">
              <Input name="password" type="password" autoComplete="current-password" required />
            </Field>
          </ActionForm>
        </div>
        <p className="mt-4 text-center text-xs text-muted">Quên mật khẩu: liên hệ Giám đốc để cấp lại.</p>
      </div>
    </div>
  )
}
