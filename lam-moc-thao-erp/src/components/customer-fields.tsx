import type { Customer } from '@prisma/client'
import { Field, FormGrid, Input, Select, Textarea } from './form'
import { CUSTOMER_STATUS_LABEL, CUSTOMER_TYPE_LABEL, INDUSTRIES, SOURCES } from '@/lib/labels'

type Props = {
  customer?: Customer
  owners: Array<{ id: string; name: string }>
  canAssign: boolean
  canCredit: boolean
  areas: string[]
}

export function CustomerFields({ customer: c, owners, canAssign, canCredit, areas }: Props) {
  return (
    <div className="space-y-6">
      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Thông tin chung</legend>
        <FormGrid>
          <Field label="Tên khách hàng" required className="sm:col-span-2">
            <Input name="name" defaultValue={c?.name} required minLength={2} placeholder="Ví dụ: Khách sạn Biển Xanh" />
          </Field>
          <Field label="Loại khách hàng" required>
            <Select name="type" defaultValue={c?.type ?? 'TO_CHUC'} options={Object.entries(CUSTOMER_TYPE_LABEL).map(([value, label]) => ({ value, label }))} />
          </Field>
          <Field label="Trạng thái">
            <Select name="status" defaultValue={c?.status ?? 'TIEM_NANG'} options={Object.entries(CUSTOMER_STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
          </Field>
          <Field label="Phân khúc">
            <Input name="industry" defaultValue={c?.industry ?? ''} list="industries" placeholder="Chọn hoặc gõ" />
            <datalist id="industries">{INDUSTRIES.map((i) => <option key={i} value={i} />)}</datalist>
          </Field>
          <Field label="Kênh tiếp nhận">
            <Input name="source" defaultValue={c?.source ?? ''} list="sources" placeholder="Chọn hoặc gõ" />
            <datalist id="sources">{SOURCES.map((i) => <option key={i} value={i} />)}</datalist>
          </Field>
          <Field label="Khu vực">
            <Input name="area" defaultValue={c?.area ?? ''} list="areas" placeholder="Ví dụ: Nha Trang" />
            <datalist id="areas">{areas.map((i) => <option key={i} value={i} />)}</datalist>
          </Field>
          <Field label="Người phụ trách" hint={canAssign ? undefined : 'Khách hàng mới tạo được giao cho chính anh/chị'}>
            <Select name="ownerId" defaultValue={c?.ownerId ?? ''} disabled={!canAssign} placeholder="Chưa giao" options={owners.map((o) => ({ value: o.id, label: o.name }))} />
          </Field>
          <Field label="Địa chỉ" className="sm:col-span-2">
            <Input name="address" defaultValue={c?.address ?? ''} />
          </Field>
        </FormGrid>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Pháp lý, hóa đơn (khách tổ chức)</legend>
        <FormGrid>
          <Field label="Mã số thuế" hint="Bắt buộc với khách tổ chức trước khi trình ký hợp đồng (QT-KD-01 mục 4)">
            <Input name="taxCode" defaultValue={c?.taxCode ?? ''} inputMode="numeric" placeholder="10 chữ số" />
          </Field>
          <Field label="Người đại diện theo pháp luật">
            <Input name="legalRep" defaultValue={c?.legalRep ?? ''} />
          </Field>
          <Field label="Người nhận hóa đơn, email nhận hóa đơn điện tử" className="sm:col-span-2">
            <Input name="invoiceInfo" defaultValue={c?.invoiceInfo ?? ''} />
          </Field>
        </FormGrid>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Người liên hệ</legend>
        <FormGrid>
          <Field label="Họ tên">
            <Input name="contactName" defaultValue={c?.contactName ?? ''} />
          </Field>
          <Field label="Chức vụ">
            <Input name="contactTitle" defaultValue={c?.contactTitle ?? ''} />
          </Field>
          <Field label="Điện thoại">
            <Input name="contactPhone" defaultValue={c?.contactPhone ?? ''} inputMode="tel" />
          </Field>
          <Field label="Email">
            <Input name="contactEmail" defaultValue={c?.contactEmail ?? ''} type="email" />
          </Field>
        </FormGrid>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Thanh toán, công nợ</legend>
        <FormGrid>
          <Field label="Hạn mức nợ (đồng)" hint="Khách lẻ: 0. Khách tổ chức: PGĐ Kinh doanh duyệt đến 30 triệu, vượt mức do Giám đốc duyệt">
            <Input name="creditLimit" defaultValue={c?.creditLimit ?? 0} inputMode="numeric" disabled={!canCredit} />
          </Field>
          <Field label="Thời hạn thanh toán (ngày)" hint="Tổ chức mua hàng: 15 ngày; cho thuê, chăm sóc: 10 ngày đầu tháng sau">
            <Input name="paymentTermDays" defaultValue={c?.paymentTermDays ?? 0} inputMode="numeric" disabled={!canCredit} />
          </Field>
          <Field label="Ghi chú" className="sm:col-span-2">
            <Textarea name="note" defaultValue={c?.note ?? ''} />
          </Field>
        </FormGrid>
      </fieldset>
    </div>
  )
}
