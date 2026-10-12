import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getCompany } from '@/lib/settings'
import { visibleCustomer } from '@/lib/queries/access'
import { DocTable, Signatures } from '@/components/doc-header'
import { formatVnd, vndInWords } from '@/lib/rules/money'
import { addDays, formatDate, parseDateOnly, startOfYear, todayVN } from '@/lib/rules/dates'

export const metadata = { title: 'Biên bản đối chiếu công nợ' }

/** BM-KD-09 Biên bản đối chiếu công nợ */
export default async function DebtReconciliationPage({ params, searchParams }: { params: Promise<{ customerId: string }>; searchParams: Promise<{ tu?: string; den?: string }> }) {
  const { customerId } = await params
  const sp = await searchParams
  const user = await requireUser()
  const customer = await visibleCustomer(user, customerId)
  const to = parseDateOnly(sp.den) ?? todayVN()
  const from = parseDateOnly(sp.tu) ?? startOfYear(to)
  const end = addDays(to, 1)
  const [company, receivables, payments] = await Promise.all([
    getCompany(),
    prisma.receivable.findMany({ where: { customerId, issueDate: { lt: end } }, orderBy: { issueDate: 'asc' } }),
    prisma.payment.findMany({ where: { customerId, date: { lt: end } }, orderBy: { date: 'asc' }, include: { receivable: { select: { docNo: true } } } }),
  ])
  const opening = receivables.filter((r) => r.issueDate < from).reduce((s, r) => s + r.amount, 0) - payments.filter((p) => p.date < from).reduce((s, p) => s + p.amount, 0)
  const rows = [
    ...receivables.filter((r) => r.issueDate >= from).map((r) => ({ date: r.issueDate, doc: r.docNo ?? '', text: r.description, debit: r.amount, credit: 0 })),
    ...payments.filter((p) => p.date >= from).map((p) => ({ date: p.date, doc: p.reference ?? '', text: `Thanh toán ${p.receivable.docNo ?? ''}`.trim(), debit: 0, credit: p.amount })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime())
  const debit = rows.reduce((s, r) => s + r.debit, 0)
  const credit = rows.reduce((s, r) => s + r.credit, 0)
  const closing = opening + debit - credit

  return (
    <>
      <div className="text-center">
        <div className="font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
        <div className="font-bold">Độc lập - Tự do - Hạnh phúc</div>
        <div>---------------oOo---------------</div>
      </div>
      <h1 className="mt-4 text-center text-xl font-bold">BIÊN BẢN ĐỐI CHIẾU CÔNG NỢ</h1>
      <p className="text-center italic">Từ ngày {formatDate(from)} đến ngày {formatDate(to)}</p>
      <p className="mt-4 indent-8">
        Căn cứ các hợp đồng, hóa đơn và chứng từ thanh toán giữa {company.name} (Bên A) và {customer.name}
        {customer.taxCode ? `, mã số thuế ${customer.taxCode}` : ''} (Bên B). Hai bên đối chiếu công nợ như sau:
      </p>
      <DocTable>
        <thead>
          <tr className="text-center"><th className="w-10">STT</th><th className="w-24">Ngày</th><th>Số chứng từ / hóa đơn</th><th>Diễn giải</th><th className="w-28">Phát sinh nợ</th><th className="w-28">Đã thanh toán</th></tr>
        </thead>
        <tbody>
          <tr><td colSpan={4} className="font-bold">Số dư đầu kỳ</td><td className="text-right">{formatVnd(opening)}</td><td /></tr>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="text-center">{i + 1}</td>
              <td>{formatDate(r.date)}</td>
              <td>{r.doc}</td>
              <td>{r.text}</td>
              <td className="text-right">{r.debit ? formatVnd(r.debit) : ''}</td>
              <td className="text-right">{r.credit ? formatVnd(r.credit) : ''}</td>
            </tr>
          ))}
          <tr><td colSpan={4} className="font-bold">Cộng phát sinh</td><td className="text-right font-bold">{formatVnd(debit)}</td><td className="text-right font-bold">{formatVnd(credit)}</td></tr>
          <tr><td colSpan={4} className="font-bold">Số dư cuối kỳ Bên B còn phải trả Bên A</td><td colSpan={2} className="text-right font-bold">{formatVnd(closing)}</td></tr>
        </tbody>
      </DocTable>
      <p className="italic">Bằng chữ: {vndInWords(closing)}.</p>
      <p>Trong 07 ngày kể từ ngày nhận biên bản, nếu Bên B không có ý kiến bằng văn bản thì số liệu trên được coi là đã được xác nhận.</p>
      <Signatures left={{ title: 'ĐẠI DIỆN BÊN B', note: '(Kế toán - Đại diện, ký, đóng dấu)' }} right={{ title: 'ĐẠI DIỆN BÊN A', note: '(Kế toán - Giám đốc, ký, đóng dấu)' }} />
      <p className="no-print mt-6 text-xs text-zinc-500">Đổi kỳ đối chiếu: thêm ?tu=YYYY-MM-DD&amp;den=YYYY-MM-DD vào địa chỉ trang.</p>
    </>
  )
}
