import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { Card, PageHeader } from '@/components/ui'
import { ActionForm } from '@/components/action-form'
import { CustomerFields } from '@/components/customer-fields'
import { distinctAreas, salesPeople } from '@/lib/queries/access'
import { createCustomer } from '../actions'

export const metadata = { title: 'Thêm khách hàng' }

export default async function NewCustomerPage() {
  const user = await requireUser()
  if (!can.sell(user)) redirect('/khach-hang')
  const [owners, areas] = await Promise.all([salesPeople(), distinctAreas()])
  return (
    <>
      <PageHeader title="Thêm khách hàng" back={{ href: '/khach-hang', label: 'Khách hàng' }} />
      <Card>
        <ActionForm action={createCustomer} submitLabel="Lưu khách hàng">
          <CustomerFields owners={owners} canAssign={can.assignOwner(user)} canCredit={can.assignOwner(user)} areas={areas} />
        </ActionForm>
      </Card>
    </>
  )
}
