import type { ActionState } from '@/lib/action'
import { ActionForm } from './action-form'
import { Field, Input, Select, Textarea } from './form'
import { ACTIVITY_LABEL } from '@/lib/labels'
import { toInputDate, todayVN } from '@/lib/rules/dates'

type Props = {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
  opportunities: Array<{ id: string; label: string }>
  users: Array<{ id: string; name: string }>
  currentUserId: string
  defaultOpportunityId?: string
}

export function ActivityForm({ action, opportunities, users, currentUserId, defaultOpportunityId }: Props) {
  return (
    <ActionForm action={action} submitLabel="Lưu" size="sm">
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="inline-flex items-center gap-2">
          <input type="radio" name="mode" value="done" defaultChecked className="accent-brand" /> Ghi nhận việc đã làm
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="radio" name="mode" value="plan" className="accent-brand" /> Hẹn việc cần làm
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Loại">
          <Select name="type" defaultValue="GOI_DIEN" options={Object.entries(ACTIVITY_LABEL).map(([value, label]) => ({ value, label }))} />
        </Field>
        <Field label="Cơ hội liên quan">
          <Select name="opportunityId" defaultValue={defaultOpportunityId ?? ''} placeholder="Không gắn cơ hội" options={opportunities.map((o) => ({ value: o.id, label: o.label }))} />
        </Field>
        <Field label="Nội dung chính" className="sm:col-span-2">
          <Input name="subject" required placeholder="Ví dụ: Gọi tư vấn chủng loại cây sảnh" />
        </Field>
        <Field label="Chi tiết, kết quả" className="sm:col-span-2">
          <Textarea name="content" rows={2} />
        </Field>
        <Field label="Ngày hẹn (khi hẹn việc)">
          <Input name="dueDate" type="date" defaultValue={toInputDate(todayVN())} />
        </Field>
        <Field label="Giao cho (khi hẹn việc)">
          <Select name="assigneeId" defaultValue={currentUserId} options={users.map((u) => ({ value: u.id, label: u.name }))} />
        </Field>
      </div>
    </ActionForm>
  )
}
