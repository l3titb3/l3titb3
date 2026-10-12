import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getCompany } from '@/lib/settings'
import { visibleQuote } from '@/lib/queries/access'
import { DocHeader, DocTable, Signatures } from '@/components/doc-header'
import { formatVnd, vndInWords } from '@/lib/rules/money'
import { formatDate } from '@/lib/rules/dates'

export const metadata = { title: 'In báo giá' }

export default async function PrintQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  await visibleQuote(user, id)
  const [company, q] = await Promise.all([
    getCompany(),
    prisma.quote.findUniqueOrThrow({ where: { id }, include: { customer: true, lines: { orderBy: { sortOrder: 'asc' } }, opportunity: { include: { survey: true } } } }),
  ])
  const approved = ['DA_DUYET', 'DA_GUI', 'THANG'].includes(q.status)
  const survey = q.opportunity?.survey
  const box = (b: boolean) => (b ? '☑' : '☐')

  return (
    <>
      {!approved && (
        <div className="mb-4 border-2 border-red-600 py-1 text-center font-bold text-red-600">BẢN NHÁP - BÁO GIÁ CHƯA ĐƯỢC DUYỆT, KHÔNG GỬI KHÁCH</div>
      )}
      <DocHeader company={company.name} number={q.number} date={q.quoteDate} />
      <h1 className="mt-2 text-center text-xl font-bold">BÁO GIÁ</h1>
      {q.title && <p className="text-center italic">V/v: {q.title}</p>}
      <p className="mt-4">Kính gửi: <b>{q.customer.name}</b></p>
      <p className="indent-8">
        Công ty TNHH Lâm Mộc Thảo trân trọng cảm ơn Quý khách đã quan tâm.{' '}
        {survey ? `Căn cứ yêu cầu và kết quả khảo sát ngày ${formatDate(survey.surveyDate)}` : 'Căn cứ yêu cầu của Quý khách'}, chúng tôi xin gửi báo giá như sau:
      </p>
      <DocTable>
        <thead>
          <tr className="text-center">
            <th className="w-10">STT</th><th>Hạng mục / Tên cây</th><th>Quy cách</th><th className="w-14">ĐVT</th><th className="w-14">SL</th><th className="w-28">Đơn giá (đồng)</th><th className="w-32">Thành tiền (đồng)</th>
          </tr>
        </thead>
        <tbody>
          {q.lines.map((l, i) => (
            <tr key={l.id}>
              <td className="text-center">{i + 1}</td>
              <td>{l.name}</td>
              <td>{l.spec}</td>
              <td className="text-center">{l.unit}</td>
              <td className="text-right">{l.quantity.toLocaleString('vi-VN')}</td>
              <td className="text-right">{formatVnd(l.unitPrice)}</td>
              <td className="text-right">{formatVnd(l.amount)}</td>
            </tr>
          ))}
          <tr><td colSpan={6} className="text-right font-bold">Cộng</td><td className="text-right font-bold">{formatVnd(q.subtotal)}</td></tr>
          <tr><td colSpan={6} className="text-right">Thuế GTGT ({q.vatRate}%)</td><td className="text-right">{formatVnd(q.vatAmount)}</td></tr>
          <tr><td colSpan={6} className="text-right font-bold">Tổng cộng</td><td className="text-right font-bold">{formatVnd(q.total)}</td></tr>
        </tbody>
      </DocTable>
      <p className="italic">Bằng chữ: {vndInWords(q.total)}.</p>
      <p className="mt-3">
        <b>Điều kiện:</b> Giá đã bao gồm {box(q.includesShipping)} vận chuyển {box(q.includesInstall)} trồng, lắp đặt {box(!!q.warrantyDays)} bảo hành {q.warrantyDays ?? '......'} ngày.
        Thanh toán: {q.paymentTerms ?? '..........................'}. Thời gian thực hiện: {q.executionDays ?? '......'} ngày.
        Báo giá có hiệu lực {company.quoteValidDays} ngày kể từ ngày lập (đến hết ngày {formatDate(q.validUntil)}).
      </p>
      <p>Người liên hệ: {q.contactName ?? '..........................'} Điện thoại: {q.contactPhone ?? company.phone}</p>
      <Signatures right={{ title: 'GIÁM ĐỐC / NGƯỜI ĐƯỢC ỦY QUYỀN', note: '(Ký, ghi rõ họ tên, đóng dấu)' }} />
      <p className="mt-8 text-xs text-zinc-500">{company.name} · MST {company.taxCode} · {company.address} · ĐT {company.phone} · {company.email}</p>
    </>
  )
}
