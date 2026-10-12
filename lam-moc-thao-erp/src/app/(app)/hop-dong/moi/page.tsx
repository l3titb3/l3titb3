import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can } from '@/lib/permissions'
import { getCompany } from '@/lib/settings'
import { Card, Notice, PageHeader } from '@/components/ui'
import { ActionForm } from '@/components/action-form'
import { ContractFields, type ContractFormValues } from '@/components/contract-fields'
import { contractFormOptions, DEFAULT_TERM_DAYS, SEGMENT_CONTRACT_TYPE } from '@/lib/queries/contract-form'
import { visibleCustomer, visibleQuote } from '@/lib/queries/access'
import { addDays, toInputDate, todayVN } from '@/lib/rules/dates'
import { saveContract } from '../actions'

export const metadata = { title: 'Lập hợp đồng' }

export default async function NewContractPage({ searchParams }: { searchParams: Promise<{ 'bao-gia'?: string; khach?: string }> }) {
  const user = await requireUser()
  if (!can.sell(user)) redirect('/hop-dong')
  const sp = await searchParams
  const [company, opts] = await Promise.all([getCompany(), contractFormOptions(user)])

  let values: ContractFormValues = {
    type: '', customerId: '', segmentId: '', title: '', value: '', vatRate: company.defaultVatRate, startDate: '', endDate: '',
    paymentTermDays: 15, advancePercent: 0, retentionPercent: 0, warrantyDays: '', ownerId: user.id, note: '',
  }
  let quoteNumber: string | null = null
  if (sp['bao-gia']) {
    const q = await visibleQuote(user, sp['bao-gia'])
    const [customer, opp, firstLine] = await Promise.all([
      prisma.customer.findUniqueOrThrow({ where: { id: q.customerId } }),
      q.opportunityId ? prisma.opportunity.findUnique({ where: { id: q.opportunityId }, select: { title: true } }) : null,
      prisma.quoteLine.findFirst({ where: { quoteId: q.id }, orderBy: { sortOrder: 'asc' }, select: { name: true } }),
    ])
    const type = SEGMENT_CONTRACT_TYPE[q.segmentId] ?? 'MUA_BAN'
    const term = ['CHO_THUE', 'CHAM_SOC', 'VSMT'].includes(type)
    values = {
      ...values,
      quoteId: q.id, type, customerId: q.customerId, segmentId: q.segmentId, title: q.title ?? opp?.title ?? firstLine?.name ?? '', value: q.subtotal, vatRate: q.vatRate,
      startDate: term ? toInputDate(todayVN()) : '', endDate: term ? toInputDate(addDays(todayVN(), 365)) : '',
      paymentTermDays: customer.paymentTermDays || DEFAULT_TERM_DAYS[type], advancePercent: type === 'THI_CONG' ? 30 : 0,
      warrantyDays: q.warrantyDays ?? '', ownerId: customer.ownerId ?? user.id,
    }
    quoteNumber = q.number
  } else if (sp.khach) {
    const customer = await visibleCustomer(user, sp.khach)
    values = { ...values, customerId: customer.id, ownerId: customer.ownerId ?? user.id, paymentTermDays: customer.paymentTermDays || 15 }
  }

  return (
    <>
      <PageHeader title="Lập hợp đồng" description="QT-KD-01 bước 7: soạn hợp đồng theo mẫu, Phòng HCKT rà soát, trình ký đúng thẩm quyền." back={{ href: '/hop-dong', label: 'Hợp đồng' }} />
      {quoteNumber && <div className="mb-4"><Notice tone="indigo">Lập từ báo giá {quoteNumber}. Giá trị lấy theo tiền hàng chưa VAT của báo giá, sửa nếu có thương lượng.</Notice></div>}
      <Card>
        <ActionForm action={saveContract.bind(null, null)} submitLabel="Lưu hợp đồng (soạn thảo)">
          <ContractFields values={values} customers={opts.customers} segments={opts.segments} owners={opts.owners} canAssign={can.assignOwner(user)} lockParty={!!quoteNumber} limits={company} />
        </ActionForm>
      </Card>
    </>
  )
}
