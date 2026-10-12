import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { getCompany } from '@/lib/settings'
import { Card, PageHeader } from '@/components/ui'
import { ActionForm } from '@/components/action-form'
import { ContractFields } from '@/components/contract-fields'
import { contractFormOptions } from '@/lib/queries/contract-form'
import { visibleContract } from '@/lib/queries/access'
import { toInputDate } from '@/lib/rules/dates'
import { saveContract } from '../../actions'

export const metadata = { title: 'Sửa hợp đồng' }

export default async function EditContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const c = await visibleContract(user, id)
  if (c.status !== 'SOAN_THAO' || !can.editSales(user, c)) redirect(`/hop-dong/${id}`)
  const [company, opts] = await Promise.all([getCompany(), contractFormOptions(user)])
  return (
    <>
      <PageHeader title={`Sửa hợp đồng ${c.number}`} back={{ href: `/hop-dong/${id}`, label: c.number }} />
      <Card>
        <ActionForm action={saveContract.bind(null, id)} submitLabel="Lưu thay đổi">
          <ContractFields
            values={{
              type: c.type, customerId: c.customerId, segmentId: c.segmentId, title: c.title, value: c.value, vatRate: c.vatRate,
              startDate: toInputDate(c.startDate), endDate: toInputDate(c.endDate), paymentTermDays: c.paymentTermDays, advancePercent: c.advancePercent,
              retentionPercent: c.retentionPercent, warrantyDays: c.warrantyDays ?? '', ownerId: c.ownerId ?? user.id, note: c.note ?? '',
            }}
            customers={opts.customers}
            segments={opts.segments}
            owners={opts.owners}
            canAssign={can.assignOwner(user)}
            lockParty
            limits={company}
          />
        </ActionForm>
      </Card>
    </>
  )
}
