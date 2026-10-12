import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can } from '@/lib/permissions'
import { Card, PageHeader } from '@/components/ui'
import { ActionForm } from '@/components/action-form'
import { OpportunityFields } from '@/components/opportunity-fields'
import { salesPeople, visibleOpportunity } from '@/lib/queries/access'
import { updateOpportunity } from '../../actions'

export const metadata = { title: 'Sửa cơ hội' }

export default async function EditOpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const opp = await visibleOpportunity(user, id)
  if (!can.editSales(user, opp)) redirect(`/co-hoi/${id}`)
  const [segments, owners] = await Promise.all([prisma.segment.findMany({ orderBy: { sortOrder: 'asc' } }), salesPeople()])
  return (
    <>
      <PageHeader title={`Sửa: ${opp.title}`} back={{ href: `/co-hoi/${id}`, label: opp.code }} />
      <Card>
        <ActionForm action={updateOpportunity.bind(null, id)} submitLabel="Lưu thay đổi">
          <OpportunityFields opp={opp} segments={segments} owners={owners} canAssign={can.assignOwner(user)} />
        </ActionForm>
      </Card>
    </>
  )
}
