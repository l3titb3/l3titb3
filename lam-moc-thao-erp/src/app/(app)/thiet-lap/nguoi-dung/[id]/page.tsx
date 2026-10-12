import { notFound, redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can } from '@/lib/permissions'
import { Card, PageHeader } from '@/components/ui'
import { ActionForm } from '@/components/action-form'
import { Checkbox, Field, FormGrid, Input, Select } from '@/components/form'
import { ROLE_LABEL } from '@/lib/labels'
import { resetPassword, updateUser } from '../../actions'

export const metadata = { title: 'Sửa người dùng' }

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  if (!can.manageSettings(user)) redirect('/')
  const u = await prisma.user.findUnique({ where: { id } })
  if (!u) notFound()
  return (
    <>
      <PageHeader title={u.name} back={{ href: '/thiet-lap/nguoi-dung', label: 'Người dùng' }} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="Thông tin tài khoản" className="xl:col-span-2">
          <ActionForm action={updateUser.bind(null, id)} submitLabel="Lưu">
            <FormGrid>
              <Field label="Họ tên" required><Input name="name" defaultValue={u.name} required /></Field>
              <Field label="Chức danh" required><Input name="title" defaultValue={u.title} required /></Field>
              <Field label="Email đăng nhập" required><Input name="email" type="email" defaultValue={u.email} required /></Field>
              <Field label="Điện thoại"><Input name="phone" defaultValue={u.phone ?? ''} /></Field>
              <Field label="Vai trò"><Select name="role" defaultValue={u.role} options={Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }))} /></Field>
              <div className="flex flex-col gap-2 self-end pb-2">
                <Checkbox name="isChairman" label="Là Chủ tịch HĐTV" defaultChecked={u.isChairman} />
                <Checkbox name="active" label="Đang hoạt động" defaultChecked={u.active} />
              </div>
            </FormGrid>
          </ActionForm>
        </Card>
        <Card title="Mật khẩu">
          <p className="mb-3 text-sm text-muted">Cấp mật khẩu tạm khi người dùng quên mật khẩu. Người dùng phải đổi ở lần đăng nhập tiếp theo.</p>
          <ActionForm action={resetPassword.bind(null, id)} submitLabel="Cấp lại mật khẩu" variant="secondary" confirm="Cấp mật khẩu tạm mới? Phiên đăng nhập hiện tại của người này sẽ bị đăng xuất." />
        </Card>
      </div>
    </>
  )
}
