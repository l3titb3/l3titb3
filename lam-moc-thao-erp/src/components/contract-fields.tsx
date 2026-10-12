import type { ContractType } from '@prisma/client'
import { Field, FormGrid, Input, Select, Textarea } from './form'
import { CONTRACT_TYPE_LABEL, VAT_RATES } from '@/lib/labels'
import { formatVnd } from '@/lib/rules/money'

export type ContractFormValues = {
  type: ContractType | ''
  customerId: string
  segmentId: string
  title: string
  value: number | ''
  vatRate: number
  startDate: string
  endDate: string
  paymentTermDays: number
  advancePercent: number
  retentionPercent: number
  warrantyDays: number | ''
  ownerId: string
  note: string
  quoteId?: string
}

type Props = {
  values: ContractFormValues
  customers: Array<{ id: string; label: string }>
  segments: Array<{ id: string; name: string }>
  owners: Array<{ id: string; name: string }>
  canAssign: boolean
  lockParty: boolean
  limits: { pgdSignLimit: number; gdSignLimit: number }
}

export function ContractFields({ values: v, customers, segments, owners, canAssign, lockParty, limits }: Props) {
  return (
    <div className="space-y-6">
      {v.quoteId && <input type="hidden" name="quoteId" value={v.quoteId} />}
      <FormGrid>
        <Field label="Loại hợp đồng (theo bộ mẫu 03.x)" required>
          <Select name="type" defaultValue={v.type} required disabled={lockParty} placeholder="Chọn loại" options={Object.entries(CONTRACT_TYPE_LABEL).map(([value, label]) => ({ value, label }))} />
          {lockParty && <input type="hidden" name="type" value={v.type} />}
        </Field>
        <Field label="Khách hàng" required>
          <Select name="customerId" defaultValue={v.customerId} required disabled={lockParty} placeholder="Chọn khách hàng" options={customers.map((c) => ({ value: c.id, label: c.label }))} />
          {lockParty && <input type="hidden" name="customerId" value={v.customerId} />}
        </Field>
        <Field label="Mảng kinh doanh" required>
          <Select name="segmentId" defaultValue={v.segmentId} required placeholder="Chọn mảng" options={segments.map((s) => ({ value: s.id, label: s.name }))} />
        </Field>
        <Field label="Người phụ trách">
          <Select name="ownerId" defaultValue={v.ownerId} disabled={!canAssign} options={owners.map((o) => ({ value: o.id, label: o.name }))} />
        </Field>
        <Field label="Tên, nội dung hợp đồng" required className="sm:col-span-2">
          <Input name="title" defaultValue={v.title} required placeholder="Ví dụ: Thi công sân vườn biệt thự" />
        </Field>
        <Field label="Giá trị chưa VAT (đồng)" required>
          <Input name="value" defaultValue={v.value} inputMode="numeric" required />
        </Field>
        <Field label="Thuế suất GTGT">
          <Select name="vatRate" defaultValue={String(v.vatRate)} options={VAT_RATES.map((r) => ({ value: String(r), label: `${r}%` }))} />
        </Field>
        <Field label="Ngày bắt đầu" hint="Bắt buộc với hợp đồng cho thuê, chăm sóc, vệ sinh môi trường">
          <Input name="startDate" type="date" defaultValue={v.startDate} />
        </Field>
        <Field label="Ngày kết thúc" hint="Hệ thống nhắc tái ký trước 30 ngày">
          <Input name="endDate" type="date" defaultValue={v.endDate} />
        </Field>
        <Field label="Thời hạn thanh toán mỗi đợt (ngày)">
          <Input name="paymentTermDays" defaultValue={v.paymentTermDays} inputMode="numeric" />
        </Field>
        <Field label="Tạm ứng khi ký (%)" hint="Thi công: tạm ứng 30 - 50% (Điều 6 Quy chế tài chính)">
          <Input name="advancePercent" defaultValue={v.advancePercent} inputMode="decimal" />
        </Field>
        <Field label="Giữ lại bảo hành (%)" hint="Tối đa 5%">
          <Input name="retentionPercent" defaultValue={v.retentionPercent} inputMode="decimal" />
        </Field>
        <Field label="Bảo hành (ngày)" hint="Cây bóng mát, cây lớn 90 ngày; cây bụi, thảm cỏ 30 ngày (mẫu 03.1)">
          <Input name="warrantyDays" defaultValue={v.warrantyDays} inputMode="numeric" />
        </Field>
        <Field label="Ghi chú" className="sm:col-span-2">
          <Textarea name="note" defaultValue={v.note} />
        </Field>
      </FormGrid>
      <div className="rounded-xl bg-brand-soft px-4 py-3 text-sm text-indigo-950">
        <b>Thẩm quyền ký (Điều 9 Quy chế tổ chức), tính trên giá trị gồm VAT:</b>
        <ul className="mt-1 list-disc pl-5">
          <li>Mua bán, cho thuê, dịch vụ dưới {formatVnd(limits.pgdSignLimit)} đ: PGĐ Kinh doanh ký (GUQ 02/2026).</li>
          <li>Từ {formatVnd(limits.pgdSignLimit)} đ đến dưới {formatVnd(limits.gdSignLimit)} đ, và hợp đồng thi công: Giám đốc ký (GUQ 01/2026).</li>
          <li>Từ {formatVnd(limits.gdSignLimit)} đ: Giám đốc đề xuất, ký; Chủ tịch HĐTV phê duyệt.</li>
        </ul>
        <p className="mt-1">Trước khi trình ký, Phòng HCKT rà soát hình thức hợp đồng. Không sửa điều khoản mẫu khi chưa được Giám đốc đồng ý.</p>
      </div>
    </div>
  )
}
