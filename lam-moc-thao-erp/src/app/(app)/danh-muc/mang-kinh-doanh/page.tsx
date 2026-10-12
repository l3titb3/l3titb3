import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can } from '@/lib/permissions'
import { Badge, Card, PageHeader, RuleBadge } from '@/components/ui'
import { ActionForm } from '@/components/action-form'
import { Field, Input } from '@/components/form'
import { formatVnd } from '@/lib/rules/money'
import { saveSegment } from '../actions'

export const metadata = { title: 'Mảng kinh doanh' }

export default async function SegmentsPage() {
  const user = await requireUser()
  const segments = await prisma.segment.findMany({ orderBy: { sortOrder: 'asc' } })
  const edit = can.manageSettings(user)
  return (
    <>
      <PageHeader
        title="Mảng kinh doanh và biên lợi nhuận"
        description="Biên LN gộp mục tiêu và mức sàn theo QT-KD-01 mục 3 (mức sàn thấp hơn mục tiêu 10 điểm %). Mã công trình, quỹ thưởng theo Quy chế phân bổ lợi nhuận Điều 4, 5."
      />
      <div className="space-y-4">
        {segments.map((s) => (
          <Card
            key={s.id}
            title={s.name}
            badge={
              <span className="flex gap-2">
                <RuleBadge />
                {s.floorMargin === null && <Badge tone="orange">Chưa quy định biên sàn: báo giá trình Giám đốc</Badge>}
                {s.allocatesProfit && <Badge tone="gray">Có mã công trình từ {formatVnd(s.projectCodeMinValue)} đ</Badge>}
              </span>
            }
          >
            {edit ? (
              <ActionForm action={saveSegment.bind(null, s.id)} submitLabel="Lưu" size="sm">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
                  <Field label="Tên mảng" className="col-span-2 xl:col-span-2"><Input name="name" defaultValue={s.name} /></Field>
                  <Field label="Biên mục tiêu từ (%)"><Input name="targetMarginMin" defaultValue={s.targetMarginMin ?? ''} inputMode="decimal" /></Field>
                  <Field label="đến (%)"><Input name="targetMarginMax" defaultValue={s.targetMarginMax ?? ''} inputMode="decimal" /></Field>
                  <Field label="Mức sàn (%)"><Input name="floorMargin" defaultValue={s.floorMargin ?? ''} inputMode="decimal" /></Field>
                  <Field label="Biên LNĐG sàn (%)"><Input name="contributionFloor" defaultValue={s.contributionFloor ?? ''} inputMode="decimal" /></Field>
                  <Field label="Trích quỹ thưởng (%)"><Input name="bonusRate" defaultValue={s.bonusRate ?? ''} inputMode="decimal" /></Field>
                  <Field label="Cấp mã công trình từ (đồng, chưa VAT)" className="col-span-2"><Input name="projectCodeMinValue" defaultValue={s.projectCodeMinValue ?? ''} inputMode="numeric" disabled={!s.allocatesProfit} /></Field>
                  <Field label="Ghi chú" className="col-span-2 xl:col-span-5"><Input name="note" defaultValue={s.note ?? ''} /></Field>
                </div>
              </ActionForm>
            ) : (
              <p className="text-sm">
                Biên LN gộp mục tiêu: {s.targetMarginMin !== null ? `${s.targetMarginMin}-${s.targetMarginMax}%` : 'chưa quy định'} · Mức sàn: {s.floorMargin !== null ? `${s.floorMargin}%` : 'chưa quy định'}
                {s.contributionFloor !== null && ` · Biên LNĐG sàn ${s.contributionFloor}%, trích quỹ thưởng ${s.bonusRate}%`}
              </p>
            )}
          </Card>
        ))}
      </div>
    </>
  )
}
