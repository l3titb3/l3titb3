import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { receivableScope } from '@/lib/permissions'
import { getCompany } from '@/lib/settings'
import { DocHeader, DocTable, Signatures } from '@/components/doc-header'
import { formatVnd, roundVnd, vndInWords } from '@/lib/rules/money'
import { formatDate, todayVN } from '@/lib/rules/dates'

export const metadata = { title: 'Đề nghị thanh toán' }

/** BM-KD-08 Đề nghị thanh toán gửi khách hàng */
export default async function PaymentRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const r = await prisma.receivable.findFirst({ where: { AND: [{ id }, receivableScope(user)] }, include: { customer: true, contract: { include: { receivables: { orderBy: { issueDate: 'asc' } } } } } })
  if (!r || !r.contract) notFound()
  const company = await getCompany()
  const c = r.contract
  const index = c.receivables.findIndex((x) => x.id === id)
  const cumulative = c.receivables.slice(0, index + 1).reduce((s, x) => s + x.amount, 0)
  const paidBefore = c.receivables.reduce((s, x) => s + x.paidAmount, 0)
  const retention = roundVnd((c.total * c.retentionPercent) / 100)
  const today = todayVN()

  return (
    <>
      <DocHeader company={company.name} number={`....../${today.getUTCFullYear()}/ĐNTT-LMT`} date={today} />
      <h1 className="mt-2 text-center text-xl font-bold">ĐỀ NGHỊ THANH TOÁN</h1>
      <p className="mt-4">Kính gửi: <b>{r.customer.name}</b></p>
      <p>Căn cứ Hợp đồng số {c.number} ngày {formatDate(c.signDate)}; căn cứ Biên bản nghiệm thu/giao nhận số ................ ngày ..... /..... /20.....</p>
      <p>{company.name} đề nghị Quý Công ty thanh toán đợt {index + 1} như sau:</p>
      <DocTable>
        <thead><tr className="text-center"><th className="w-10">STT</th><th>Nội dung</th><th className="w-40">Số tiền (đồng)</th></tr></thead>
        <tbody>
          <tr><td className="text-center">1</td><td>Giá trị hợp đồng (gồm VAT)</td><td className="text-right">{formatVnd(c.total)}</td></tr>
          <tr><td className="text-center">2</td><td>Giá trị đã nghiệm thu lũy kế</td><td className="text-right">{formatVnd(cumulative)}</td></tr>
          <tr><td className="text-center">3</td><td>Đã thanh toán, tạm ứng</td><td className="text-right">{formatVnd(paidBefore)}</td></tr>
          <tr><td className="text-center">4</td><td>Giữ lại bảo hành (nếu có)</td><td className="text-right">{retention ? formatVnd(retention) : '-'}</td></tr>
          <tr><td className="text-center">5</td><td className="font-bold">Giá trị đề nghị thanh toán đợt này</td><td className="text-right font-bold">{formatVnd(r.amount - r.paidAmount)}</td></tr>
        </tbody>
      </DocTable>
      <p className="italic">Bằng chữ: {vndInWords(r.amount - r.paidAmount)}.</p>
      <p>
        Thông tin chuyển khoản: {company.name}, số tài khoản {company.bankAccount ?? '........................'} tại Ngân hàng {company.bankName ?? '........................'}.
        Hồ sơ kèm theo: biên bản nghiệm thu/giao nhận, hóa đơn điện tử số {r.docNo ?? '..........'}. Hạn thanh toán: {formatDate(r.dueDate)}.
      </p>
      <Signatures right={{ title: 'GIÁM ĐỐC', note: '(Ký, ghi rõ họ tên, đóng dấu)', name: company.director }} />
    </>
  )
}
