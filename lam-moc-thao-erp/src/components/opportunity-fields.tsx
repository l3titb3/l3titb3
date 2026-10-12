import type { Opportunity, Segment } from '@prisma/client'
import { Field, FormGrid, Input, Select, Textarea } from './form'
import { SOURCES } from '@/lib/labels'
import { toInputDate } from '@/lib/rules/dates'

export function OpportunityFields({ opp, segments, owners, canAssign }: { opp?: Opportunity; segments: Segment[]; owners: Array<{ id: string; name: string }>; canAssign: boolean }) {
  return (
    <FormGrid>
      <Field label="Nhu cầu của khách" required className="sm:col-span-2">
        <Input name="title" defaultValue={opp?.title} required placeholder="Ví dụ: Cho thuê 20 chậu cây sảnh khách sạn" />
      </Field>
      <Field label="Mảng kinh doanh" required>
        <Select name="segmentId" defaultValue={opp?.segmentId ?? ''} required placeholder="Chọn mảng" options={segments.map((s) => ({ value: s.id, label: s.name }))} />
      </Field>
      <Field label="Phân loại (QT-KD-01 bước 2)">
        <Select
          name="kind"
          defaultValue={opp && !opp.needsSurvey ? 'retail' : 'survey'}
          options={[
            { value: 'survey', label: 'Đơn lớn, cho thuê, chăm sóc, thi công: cần khảo sát' },
            { value: 'retail', label: 'Mua lẻ hàng có sẵn: báo giá ngay' },
          ]}
        />
      </Field>
      <Field label="Giá trị dự kiến (đồng)">
        <Input name="expectedValue" defaultValue={opp?.expectedValue ?? ''} inputMode="numeric" placeholder="0" />
      </Field>
      <Field label="Dự kiến chốt">
        <Input name="expectedCloseDate" type="date" defaultValue={toInputDate(opp?.expectedCloseDate)} />
      </Field>
      <Field label="Kênh tiếp nhận">
        <Input name="source" defaultValue={opp?.source ?? ''} list="opp-sources" />
        <datalist id="opp-sources">{SOURCES.map((s) => <option key={s} value={s} />)}</datalist>
      </Field>
      <Field label="Người phụ trách">
        <Select name="ownerId" defaultValue={opp?.ownerId ?? ''} disabled={!canAssign} placeholder="Tôi phụ trách" options={owners.map((o) => ({ value: o.id, label: o.name }))} />
      </Field>
      <Field label="Ghi chú" className="sm:col-span-2">
        <Textarea name="note" defaultValue={opp?.note ?? ''} />
      </Field>
    </FormGrid>
  )
}
