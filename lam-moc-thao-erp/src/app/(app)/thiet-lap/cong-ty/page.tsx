import { requireUser } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { getCompany } from '@/lib/settings'
import { Card, DescList, Notice, PageHeader, RuleBadge } from '@/components/ui'
import { ActionForm } from '@/components/action-form'
import { Checkbox, Field, FormGrid, Input } from '@/components/form'
import { formatVnd } from '@/lib/rules/money'
import { saveCompany } from '../actions'

export const metadata = { title: 'Thông tin công ty' }

export default async function CompanyPage() {
  const user = await requireUser()
  const c = await getCompany()
  const edit = can.manageSettings(user)
  const params = (
    <DescList
      items={[
        ['Thuế suất GTGT mặc định', `${c.defaultVatRate}%`],
        ['Báo giá trình Giám đốc từ', `${formatVnd(c.quoteGdThreshold)} đ (gồm VAT)`],
        ['PGĐ Kinh doanh ký hợp đồng dưới', `${formatVnd(c.pgdSignLimit)} đ (GUQ 02/2026)`],
        ['Giám đốc ký hợp đồng dưới', `${formatVnd(c.gdSignLimit)} đ (GUQ 01/2026)`],
        ['PGĐ Kinh doanh duyệt hạn mức nợ đến', `${formatVnd(c.pgdCreditLimit)} đ/khách hàng`],
        ['Ngưỡng nợ quá hạn trên 30 ngày', `${c.overdueRatioLimit}% tổng nợ phải thu`],
        ['Hiệu lực báo giá', `${c.quoteValidDays} ngày`],
      ]}
    />
  )
  if (!edit) {
    return (
      <>
        <PageHeader title="Thông tin công ty" />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card title={c.name}>
            <DescList items={[['Mã số thuế', c.taxCode], ['Địa chỉ', c.address], ['Điện thoại', c.phone], ['Email', c.email], ['Người đại diện theo pháp luật', `${c.legalRep} - ${c.legalRepTitle}`], ['Giám đốc', c.director], ['Tài khoản', c.bankAccount ? `${c.bankAccount} - ${c.bankName}` : null]]} />
          </Card>
          <Card title="Tham số quy chế" badge={<RuleBadge />}>{params}</Card>
        </div>
      </>
    )
  }
  return (
    <>
      <PageHeader title="Thông tin công ty, tham số" description="Thông tin in trên báo giá, đề nghị thanh toán, đối chiếu công nợ; ngưỡng phê duyệt theo quy chế." />
      <div className="mb-6"><Notice>Chỉ thay đổi các ngưỡng phê duyệt khi HĐTV hoặc Giám đốc đã ban hành văn bản sửa đổi quy chế, giấy ủy quyền tương ứng.</Notice></div>
      <ActionForm action={saveCompany} submitLabel="Lưu">
        <Card title="Thông tin doanh nghiệp">
          <FormGrid>
            <Field label="Tên doanh nghiệp" className="sm:col-span-2"><Input name="name" defaultValue={c.name} required /></Field>
            <Field label="Mã số thuế"><Input name="taxCode" defaultValue={c.taxCode} required /></Field>
            <Field label="Điện thoại"><Input name="phone" defaultValue={c.phone} required /></Field>
            <Field label="Địa chỉ trụ sở" className="sm:col-span-2"><Input name="address" defaultValue={c.address} required /></Field>
            <Field label="Email"><Input name="email" defaultValue={c.email} required /></Field>
            <Field label="Giám đốc"><Input name="director" defaultValue={c.director} required /></Field>
            <Field label="Người đại diện theo pháp luật"><Input name="legalRep" defaultValue={c.legalRep} required /></Field>
            <Field label="Chức danh người đại diện"><Input name="legalRepTitle" defaultValue={c.legalRepTitle} required /></Field>
            <Field label="Số tài khoản ngân hàng"><Input name="bankAccount" defaultValue={c.bankAccount ?? ''} /></Field>
            <Field label="Tại ngân hàng"><Input name="bankName" defaultValue={c.bankName ?? ''} /></Field>
          </FormGrid>
        </Card>
        <Card title="Tham số quy chế" badge={<RuleBadge />}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Thuế GTGT mặc định (%)" hint="Kế toán xác nhận theo mặt hàng, thời kỳ"><Input name="defaultVatRate" defaultValue={c.defaultVatRate} inputMode="decimal" /></Field>
            <Field label="Báo giá trình GĐ từ (đồng)" hint="QT-KD-01 bước 5"><Input name="quoteGdThreshold" defaultValue={c.quoteGdThreshold} inputMode="numeric" /></Field>
            <Field label="PGĐ KD ký HĐ dưới (đồng)" hint="GUQ 02/2026"><Input name="pgdSignLimit" defaultValue={c.pgdSignLimit} inputMode="numeric" /></Field>
            <Field label="GĐ ký HĐ dưới (đồng)" hint="Từ mức này CT HĐTV phê duyệt"><Input name="gdSignLimit" defaultValue={c.gdSignLimit} inputMode="numeric" /></Field>
            <Field label="PGĐ KD duyệt nợ đến (đồng)" hint="Điều 6 Quy chế tài chính"><Input name="pgdCreditLimit" defaultValue={c.pgdCreditLimit} inputMode="numeric" /></Field>
            <Field label="Ngưỡng nợ quá hạn > 30 ngày (%)" hint="Điều 9a Quy chế phân bổ LN"><Input name="overdueRatioLimit" defaultValue={c.overdueRatioLimit} inputMode="decimal" /></Field>
            <Field label="Hiệu lực báo giá (ngày)"><Input name="quoteValidDays" defaultValue={c.quoteValidDays} inputMode="numeric" /></Field>
          </div>
          <div className="mt-4">
            <Checkbox name="demoData" label="Đang dùng dữ liệu mẫu (hiện dải cảnh báo trên mọi trang)" defaultChecked={c.demoData} />
          </div>
        </Card>
      </ActionForm>
    </>
  )
}
