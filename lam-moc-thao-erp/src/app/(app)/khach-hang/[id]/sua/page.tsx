import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { Card, PageHeader } from '@/components/ui'
import { ActionForm } from '@/components/action-form'
import { CustomerFields } from '@/components/customer-fields'
import { distinctAreas, salesPeople, visibleCustomer } from '@/lib/queries/access'
import { updateCustomer } from '../../actions'

export const metadata = { title: 'Sửa khách hàng' }

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const customer = await visibleCustomer(user, id)
  if (!can.editCustomer(user, customer)) redirect(`/khach-hang/${id}`)
  const [owners, areas] = await Promise.all([salesPeople(), distinctAreas()])
  const canCredit = can.assignOwner(user)
  return (
    <>
      <PageHeader title={`Sửa: ${customer.name}`} back={{ href: `/khach-hang/${id}`, label: customer.code }} />
      <Card>
        <ActionForm action={updateCustomer.bind(null, id)} submitLabel="Lưu thay đổi">
          <CustomerFields customer={customer} owners={owners} canAssign={can.assignOwner(user)} canCredit={canCredit} areas={areas} />
        </ActionForm>
      </Card>
    </>
  )
}
