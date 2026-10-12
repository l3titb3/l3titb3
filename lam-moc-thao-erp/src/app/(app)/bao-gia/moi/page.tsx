import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can } from '@/lib/permissions'
import { PageHeader } from '@/components/ui'
import { QuoteEditor } from '@/components/quote-editor'
import { quoteEditorOptions } from '@/lib/queries/quote-editor'
import { toInputDate, todayVN } from '@/lib/rules/dates'
import { saveQuote } from '../actions'

export const metadata = { title: 'Lập báo giá' }

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ khach?: string; 'co-hoi'?: string }> }) {
  const user = await requireUser()
  if (!can.sell(user)) redirect('/bao-gia')
  const sp = await searchParams
  const opts = await quoteEditorOptions(user)
  const opp = sp['co-hoi'] ? opts.opportunities.find((o) => o.id === sp['co-hoi']) : undefined
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, phone: true } })
  return (
    <>
      <PageHeader title="Lập báo giá (BM-KD-02)" description="Không báo giá miệng cho đơn hàng từ 10 triệu đồng. Báo giá có hiệu lực 15 ngày." back={{ href: '/bao-gia', label: 'Báo giá' }} />
      <QuoteEditor
        action={saveQuote.bind(null, null)}
        submitLabel="Lưu báo giá nháp"
        initial={{
          customerId: opp?.customerId ?? sp.khach ?? '',
          opportunityId: opp?.id ?? '',
          segmentId: opp?.segmentId ?? '',
          title: '',
          quoteDate: toInputDate(todayVN()),
          vatRate: opts.company.defaultVatRate,
          includesShipping: true,
          includesInstall: false,
          warrantyDays: '30',
          paymentTerms: '',
          executionDays: '',
          contactName: me?.name ?? '',
          contactPhone: me?.phone ?? opts.company.phone,
          note: '',
          lines: [],
        }}
        customers={opts.customers}
        opportunities={opts.opportunities}
        segments={opts.segments}
        products={opts.products}
        vatRates={opts.vatRates}
        validDays={opts.company.quoteValidDays}
        gdThreshold={opts.company.quoteGdThreshold}
      />
    </>
  )
}
