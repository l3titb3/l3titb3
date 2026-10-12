import Link from 'next/link'
import { requireUser, MIN_PASSWORD_LENGTH } from '@/lib/auth'
import { changePassword } from '@/lib/session-actions'
import { ActionForm } from '@/components/action-form'
import { Field, Input } from '@/components/form'
import { Notice } from '@/components/ui'

export const metadata = { title: 'Đổi mật khẩu' }
export const dynamic = 'force-dynamic'

export default async function ChangePasswordPage() {
  const user = await requireUser()
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm space-y-4">
        {user.mustChangePassword && <Notice>Lần đầu đăng nhập: vui lòng đổi mật khẩu được cấp trước khi sử dụng.</Notice>}
        <div className="rounded-2xl border border-line bg-white p-6">
          <h1 className="mb-1 text-xl font-bold">Đổi mật khẩu</h1>
          <p className="mb-4 text-sm text-muted">{user.name} · {user.email}</p>
          <ActionForm action={changePassword} submitLabel="Lưu mật khẩu mới">
            <Field label="Mật khẩu hiện tại">
              <Input name="current" type="password" autoComplete="current-password" required />
            </Field>
            <Field label="Mật khẩu mới" hint={`Tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`}>
              <Input name="next" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} />
            </Field>
            <Field label="Nhập lại mật khẩu mới">
              <Input name="confirm" type="password" autoComplete="new-password" required />
            </Field>
          </ActionForm>
        </div>
        {!user.mustChangePassword && (
          <p className="text-center text-sm">
            <Link href="/" className="text-brand hover:underline">← Quay lại</Link>
          </p>
        )}
      </div>
    </div>
  )
}
