import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can } from '@/lib/permissions'
import { Badge, Card, PageHeader, Table, Td, Th } from '@/components/ui'
import { ActionForm } from '@/components/action-form'
import { Checkbox, Field, FormGrid, Input, Select } from '@/components/form'
import { ROLE_LABEL } from '@/lib/labels'
import { formatDateTime } from '@/lib/rules/dates'
import { createUser } from '../actions'

export const metadata = { title: 'Người dùng' }

const RIGHTS: Array<[string, string]> = [
  ['Giám đốc', 'Toàn quyền; duyệt mọi báo giá; ký hợp đồng đến dưới 500 triệu; đề xuất hợp đồng từ 500 triệu; quản lý người dùng, tham số'],
  ['PGĐ phụ trách Kinh doanh', 'Xem toàn bộ khách hàng; giao khách cho nhân viên; duyệt báo giá đạt mức sàn dưới 100 triệu; ký hợp đồng bán hàng, cho thuê, dịch vụ dưới 200 triệu; duyệt hạn mức nợ đến 30 triệu'],
  ['PGĐ phụ trách Kỹ thuật - Thi công', 'Xem toàn bộ; lập phiếu khảo sát; sửa danh mục, giá vốn; ghi nhận nghiệm thu. Đánh dấu Chủ tịch HĐTV để phê duyệt hợp đồng từ 500 triệu'],
  ['Hành chính - Kế toán', 'Xem toàn bộ; rà soát hợp đồng trước khi trình ký; ghi hóa đơn, đợt thanh toán, phiếu thu'],
  ['Nhân viên kinh doanh', 'Chỉ thấy khách hàng mình phụ trách và khách chưa giao; lập cơ hội, báo giá, hợp đồng; ghi chăm sóc khách'],
]

export default async function UsersPage() {
  const user = await requireUser()
  if (!can.manageSettings(user)) redirect('/')
  const users = await prisma.user.findMany({ orderBy: [{ active: 'desc' }, { createdAt: 'asc' }], include: { sessions: { orderBy: { createdAt: 'desc' }, take: 1 } } })
  return (
    <>
      <PageHeader title="Người dùng" description="Năm đầu: 05 tài khoản theo cơ cấu Ban Giám đốc, Phòng HCKT, Phòng KD (Danh mục hồ sơ v3.0)." />
      <Card className="mb-6">
        <Table>
          <thead><tr><Th>Họ tên, chức danh</Th><Th>Email đăng nhập</Th><Th>Vai trò</Th><Th>Đăng nhập gần nhất</Th><Th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.active ? '' : 'opacity-50'}>
                <Td><div className="font-semibold">{u.name}</div><div className="text-xs text-muted">{u.title}</div></Td>
                <Td>{u.email}</Td>
                <Td>
                  <Badge tone="indigo">{ROLE_LABEL[u.role]}</Badge>
                  {u.isChairman && <Badge tone="green" className="ml-1">Chủ tịch HĐTV</Badge>}
                  {!u.active && <Badge tone="gray" className="ml-1">Đã khóa</Badge>}
                  {u.mustChangePassword && <Badge tone="orange" className="ml-1">Chưa đổi mật khẩu</Badge>}
                </Td>
                <Td className="text-xs text-muted">{u.sessions[0] ? formatDateTime(u.sessions[0].createdAt) : 'Chưa đăng nhập'}</Td>
                <Td><Link href={`/thiet-lap/nguoi-dung/${u.id}`} className="text-sm font-semibold text-brand hover:underline">Sửa</Link></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Thêm người dùng">
          <ActionForm action={createUser} submitLabel="Tạo tài khoản">
            <FormGrid>
              <Field label="Họ tên" required><Input name="name" required /></Field>
              <Field label="Chức danh" required><Input name="title" required /></Field>
              <Field label="Email đăng nhập" required><Input name="email" type="email" required /></Field>
              <Field label="Điện thoại"><Input name="phone" /></Field>
              <Field label="Vai trò" required><Select name="role" defaultValue="NV_KINH_DOANH" options={Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }))} /></Field>
              <div className="self-end pb-2"><Checkbox name="isChairman" label="Là Chủ tịch HĐTV" /></div>
            </FormGrid>
          </ActionForm>
        </Card>
        <Card title="Quyền theo vai trò">
          <dl className="space-y-3 text-sm">
            {RIGHTS.map(([r, d]) => (
              <div key={r}><dt className="font-semibold">{r}</dt><dd className="text-muted">{d}</dd></div>
            ))}
          </dl>
        </Card>
      </div>
    </>
  )
}
