import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can } from '@/lib/permissions'
import { PageHeader } from '@/components/ui'
import { QuoteEditor } from '@/components/quote-editor'
import { quoteEditorOptions } from '@/lib/queries/quote-editor'
import { visibleQuote } from '@/lib/queries/access'
import { toInputDate } from '@/lib/rules/dates'
import { saveQuote } from '../../actions'

export const metadata = { title: 'Sửa báo giá' }

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const quote = await visibleQuote(user, id)
  if (!['NHAP', 'TU_CHOI'].includes(quote.status) || !can.editSales(user, { createdById: quote.createdById })) redirect(`/bao-gia/${id}`)
  const [opts, lines] = await Promise.all([quoteEditorOptions(user), prisma.quoteLine.findMany({ where: { quoteId: id }, orderBy: { sortOrder: 'asc' } })])
  // Cơ hội đang gắn có thể đã đóng; vẫn giữ trong danh sách chọn
  if (quote.opportunityId && !opts.opportunities.some((o) => o.id === quote.opportunityId)) {
    const o = await prisma.opportunity.findUnique({ where: { id: quote.opportunityId } })
    if (o) opts.opportunities.push({ id: o.id, label: `${o.code} · ${o.title}`, customerId: o.customerId, segmentId: o.segmentId })
  }
  return (
    <>
      <PageHeader title={`Sửa báo giá ${quote.number}`} back={{ href: `/bao-gia/${id}`, label: quote.number }} />
      <QuoteEditor
        action={saveQuote.bind(null, id)}
        submitLabel="Lưu thay đổi"
        initial={{
          customerId: quote.customerId,
          opportunityId: quote.opportunityId ?? '',
          segmentId: quote.segmentId,
          title: quote.title ?? '',
          quoteDate: toInputDate(quote.quoteDate),
          vatRate: quote.vatRate,
          includesShipping: quote.includesShipping,
          includesInstall: quote.includesInstall,
          warrantyDays: quote.warrantyDays?.toString() ?? '',
          paymentTerms: quote.paymentTerms ?? '',
          executionDays: quote.executionDays?.toString() ?? '',
          contactName: quote.contactName ?? '',
          contactPhone: quote.contactPhone ?? '',
          note: quote.note ?? '',
          lines: lines.map((l) => ({ productId: l.productId, name: l.name, spec: l.spec ?? '', unit: l.unit, quantity: String(l.quantity), unitPrice: String(l.unitPrice), unitCost: String(l.unitCost) })),
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
