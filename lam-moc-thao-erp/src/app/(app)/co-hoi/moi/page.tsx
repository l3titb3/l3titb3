import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can, customerScope } from '@/lib/permissions'
import { Card, PageHeader } from '@/components/ui'
import { ActionForm } from '@/components/action-form'
import { Checkbox, Field, FormGrid, Input, Select } from '@/components/form'
import { OpportunityFields } from '@/components/opportunity-fields'
import { salesPeople } from '@/lib/queries/access'
import { createOpportunity } from '../actions'

export const metadata = { title: 'Tiếp nhận nhu cầu' }

function nowLocalInput(): string {
  const d = new Date(Date.now() + 7 * 3600_000)
  return d.toISOString().slice(0, 16)
}

export default async function NewOpportunityPage({ searchParams }: { searchParams: Promise<{ khach?: string }> }) {
  const user = await requireUser()
  if (!can.sell(user)) redirect('/co-hoi')
  const { khach } = await searchParams
  const [customers, segments, owners] = await Promise.all([
    prisma.customer.findMany({ where: { AND: [customerScope(user), { status: { not: 'NGUNG' } }] }, orderBy: { name: 'asc' }, select: { id: true, name: true, code: true } }),
    prisma.segment.findMany({ orderBy: { sortOrder: 'asc' } }),
    salesPeople(),
  ])
  return (
    <>
      <PageHeader title="Tiếp nhận nhu cầu khách hàng" description="QT-KD-01 bước 1, 2: tạo hồ sơ trong ngày, phân loại nhu cầu." back={{ href: '/co-hoi', label: 'Cơ hội bán hàng' }} />
      <Card>
        <ActionForm action={createOpportunity} submitLabel="Lưu cơ hội">
          <fieldset className="space-y-4">
            <legend className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Khách hàng</legend>
            <FormGrid>
              <Field label="Khách hàng đã có" className="sm:col-span-2">
                <Select name="customerId" defaultValue={khach ?? ''} placeholder="Khách hàng mới (nhập bên dưới)" options={customers.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))} />
              </Field>
            </FormGrid>
            <details className="rounded-xl border border-line px-4 py-3" open={!khach}>
              <summary className="cursor-pointer text-sm font-semibold text-brand">Khách hàng mới: nhập nhanh</summary>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Tên khách hàng">
                  <Input name="newName" placeholder="Bỏ trống nếu đã chọn khách hàng ở trên" />
                </Field>
                <Field label="Loại">
                  <Select name="newType" defaultValue="TO_CHUC" options={[{ value: 'TO_CHUC', label: 'Doanh nghiệp, tổ chức' }, { value: 'CA_NHAN', label: 'Khách lẻ / cá nhân' }]} />
                </Field>
                <Field label="Người liên hệ">
                  <Input name="newContact" />
                </Field>
                <Field label="Điện thoại">
                  <Input name="newPhone" inputMode="tel" />
                </Field>
              </div>
            </details>
          </fieldset>
          <fieldset className="space-y-4">
            <legend className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Nhu cầu</legend>
            <OpportunityFields segments={segments} owners={owners} canAssign={can.assignOwner(user)} />
            <FormGrid>
              <Field label="Thời điểm nhận yêu cầu" hint="Dùng để tính chuẩn phản hồi 15 phút">
                <Input name="receivedAt" type="datetime-local" defaultValue={nowLocalInput()} />
              </Field>
              <div className="self-end pb-2">
                <Checkbox name="contacted" label="Đã phản hồi khách" defaultChecked />
              </div>
            </FormGrid>
          </fieldset>
        </ActionForm>
      </Card>
    </>
  )
}
