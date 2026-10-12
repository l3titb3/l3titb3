import type { OpportunityStage } from '@prisma/client'
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can } from '@/lib/permissions'
import { activeUsers, visibleOpportunity } from '@/lib/queries/access'
import { Badge, ButtonLink, Card, DescList, Notice, PageHeader, Table, Td, Th } from '@/components/ui'
import { ActionForm } from '@/components/action-form'
import { Checkbox, Field, FormGrid, Input, Select, Textarea } from '@/components/form'
import { ActivityForm } from '@/components/activity-form'
import { ActivityList } from '@/components/activity-list'
import { OPPORTUNITY_STAGES, QUOTE_STATUS_LABEL, STAGE_LABEL } from '@/lib/labels'
import { formatPercent, formatVnd } from '@/lib/rules/money'
import { formatDate, formatDateTime, toInputDate, todayVN } from '@/lib/rules/dates'
import { opportunitySla } from '@/lib/sla'
import { cn } from '@/lib/cn'
import { addActivity } from '../../khach-hang/actions'
import { markContacted, markLost, moveStage, saveSurvey } from '../actions'

const NEEDS = ['Mua cây', 'Thuê cây', 'Thi công', 'Chăm sóc']

export const metadata = { title: 'Chi tiết cơ hội' }

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  await visibleOpportunity(user, id)
  const [o, activities, users] = await Promise.all([
    prisma.opportunity.findUniqueOrThrow({
      where: { id },
      include: {
        customer: true,
        segment: true,
        owner: { select: { name: true } },
        survey: { include: { surveyor: { select: { name: true } } } },
        quotes: { orderBy: { createdAt: 'desc' } },
      },
    }),
    prisma.activity.findMany({ where: { opportunityId: id }, orderBy: [{ doneAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }], include: { assignee: { select: { name: true } } } }),
    activeUsers(),
  ])
  const editable = can.editSales(user, o) && o.stage !== 'THANG' && o.stage !== 'THUA'
  const flags = opportunitySla({ ...o, quoteCount: o.quotes.length })
  const steps: OpportunityStage[] = OPPORTUNITY_STAGES.filter((s) => s !== 'THUA')
  const currentIndex = steps.indexOf(o.stage)
  const s = o.survey

  return (
    <>
      <PageHeader
        title={o.title}
        back={{ href: '/co-hoi', label: 'Cơ hội bán hàng' }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="num">{o.code}</span>·
            <Link href={`/khach-hang/${o.customerId}`} className="font-semibold text-brand hover:underline">{o.customer.name}</Link>·
            <span>{o.segment.name}</span>
            {flags.map((f) => <Badge key={f.label} tone={f.tone}>{f.label}</Badge>)}
          </span>
        }
        actions={
          <>
            {editable && <ButtonLink href={`/co-hoi/${id}/sua`} variant="secondary">Sửa</ButtonLink>}
            {editable && can.sell(user) && <ButtonLink href={`/bao-gia/moi?co-hoi=${id}`}>+ Lập báo giá</ButtonLink>}
          </>
        }
      />

      <ol className="mb-6 grid grid-cols-5 gap-1 text-center text-xs font-semibold">
        {steps.map((st, i) => {
          const done = o.stage !== 'THUA' && i <= currentIndex
          return (
            <li key={st} className={cn('rounded-lg px-2 py-2', done ? 'bg-brand text-white' : 'bg-white text-muted ring-1 ring-line', o.stage === 'THUA' && 'opacity-60')}>
              {STAGE_LABEL[st]}
            </li>
          )
        })}
      </ol>
      {o.stage === 'THUA' && (
        <div className="mb-6"><Notice tone="red">Cơ hội không thành ({formatDateTime(o.closedAt)}). Lý do: {o.lostReason}</Notice></div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Thông tin cơ hội">
            <DescList
              items={[
                ['Giá trị dự kiến', `${formatVnd(o.expectedValue)} đ`],
                ['Dự kiến chốt', o.expectedCloseDate ? formatDate(o.expectedCloseDate) : '-'],
                ['Phân loại', o.needsSurvey ? 'Cần khảo sát hiện trạng' : 'Mua lẻ hàng có sẵn'],
                ['Người phụ trách', o.owner?.name],
                ['Kênh tiếp nhận', o.source ?? o.customer.source],
                ['Nhận yêu cầu lúc', formatDateTime(o.receivedAt)],
                ['Phản hồi khách lúc', o.firstContactAt ? formatDateTime(o.firstContactAt) : null],
                ['Mục tiêu biên LN gộp', o.segment.targetMarginMin !== null ? `${o.segment.targetMarginMin}-${o.segment.targetMarginMax}% (sàn ${o.segment.floorMargin}%)` : 'Chưa quy định'],
                ['Ghi chú', o.note ?? '-'],
              ]}
            />
            {!o.firstContactAt && editable && (
              <div className="mt-4">
                <ActionForm action={markContacted.bind(null, id)} submitLabel="Ghi nhận đã phản hồi khách" size="sm" variant="secondary" />
              </div>
            )}
          </Card>

          {o.needsSurvey && (
            <Card title="Phiếu khảo sát hiện trạng (BM-KD-01)" badge={s ? <Badge tone="green">Đã khảo sát {formatDate(s.surveyDate)}</Badge> : <Badge tone="orange">Chưa khảo sát</Badge>}>
              {can.survey(user) && o.stage !== 'THUA' ? (
                <ActionForm action={saveSurvey.bind(null, id)} submitLabel={s ? 'Cập nhật phiếu khảo sát' : 'Lưu phiếu khảo sát'}>
                  <FormGrid>
                    <Field label="Ngày khảo sát" required>
                      <Input name="surveyDate" type="date" defaultValue={toInputDate(s?.surveyDate ?? todayVN())} required />
                    </Field>
                    <Field label="Người khảo sát">
                      <Select name="surveyorId" defaultValue={s?.surveyorId ?? user.id} options={users.map((u) => ({ value: u.id, label: u.name }))} />
                    </Field>
                    <Field label="Địa điểm" className="sm:col-span-2">
                      <Input name="location" defaultValue={s?.location ?? o.customer.address ?? ''} />
                    </Field>
                    <div className="flex flex-wrap gap-4 sm:col-span-2">
                      {NEEDS.map((n) => <Checkbox key={n} name="needs" value={n} label={n} defaultChecked={s?.needs.includes(n)} />)}
                    </div>
                    <Field label="Diện tích, kích thước khu vực"><Input name="areaSize" defaultValue={s?.areaSize ?? ''} /></Field>
                    <Field label="Ánh sáng (trực tiếp số giờ/ngày; tán xạ; đèn)"><Input name="light" defaultValue={s?.light ?? ''} /></Field>
                    <Field label="Hiện trạng đất, thoát nước"><Input name="soilDrainage" defaultValue={s?.soilDrainage ?? ''} /></Field>
                    <Field label="Nguồn nước tưới, điện"><Input name="waterPower" defaultValue={s?.waterPower ?? ''} /></Field>
                    <Field label="Công trình ngầm, giới hạn chiều cao"><Input name="underground" defaultValue={s?.underground ?? ''} /></Field>
                    <Field label="Đường vào cho xe tải, trung chuyển"><Input name="access" defaultValue={s?.access ?? ''} /></Field>
                    <Field label="Phong cách, ngân sách mong muốn"><Input name="styleBudget" defaultValue={s?.styleBudget ?? ''} /></Field>
                    <Field label="Thời gian khách yêu cầu"><Input name="deadline" defaultValue={s?.deadline ?? ''} /></Field>
                    <Field label="Rủi ro, lưu ý (gió biển, hơi mặn, điều hòa...)" className="sm:col-span-2"><Textarea name="risks" rows={2} defaultValue={s?.risks ?? ''} /></Field>
                    <Field label="Đường dẫn ảnh hiện trạng" className="sm:col-span-2"><Input name="photosLink" defaultValue={s?.photosLink ?? ''} placeholder="Google Drive, Zalo album..." /></Field>
                  </FormGrid>
                </ActionForm>
              ) : s ? (
                <DescList items={[['Người khảo sát', s.surveyor.name], ['Diện tích', s.areaSize], ['Ánh sáng', s.light], ['Đất, thoát nước', s.soilDrainage], ['Rủi ro', s.risks]]} />
              ) : (
                <p className="text-sm text-muted">Chưa có phiếu khảo sát.</p>
              )}
            </Card>
          )}

          <Card title="Báo giá">
            {o.quotes.length === 0 ? (
              <p className="text-sm text-muted">Chưa có báo giá.</p>
            ) : (
              <Table>
                <thead><tr><Th>Số</Th><Th>Ngày</Th><Th>Trạng thái</Th><Th className="text-right">Biên LN gộp</Th><Th className="text-right">Tổng gồm VAT</Th></tr></thead>
                <tbody>
                  {o.quotes.map((q) => (
                    <tr key={q.id}>
                      <Td><Link href={`/bao-gia/${q.id}`} className="num font-semibold hover:text-brand">{q.number}</Link></Td>
                      <Td>{formatDate(q.quoteDate)}</Td>
                      <Td><Badge tone="indigo">{QUOTE_STATUS_LABEL[q.status]}</Badge></Td>
                      <Td className="num text-right">{formatPercent(q.grossMargin)}</Td>
                      <Td className="num text-right">{formatVnd(q.total)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card title="Chăm sóc, trao đổi">
            {o.stage !== 'THUA' && (
              <div className="mb-6 rounded-xl bg-zinc-50 p-4">
                <ActivityForm action={addActivity.bind(null, o.customerId)} opportunities={[{ id, label: `${o.code} · ${o.title}` }]} users={users} currentUserId={user.id} defaultOpportunityId={id} />
              </div>
            )}
            <ActivityList items={activities} />
          </Card>
        </div>

        <div className="space-y-6">
          {editable && (
            <Card title="Cập nhật giai đoạn">
              <ActionForm action={moveStage.bind(null, id)} submitLabel="Cập nhật" size="sm">
                <Select name="stage" defaultValue={o.stage} options={(['TIEP_NHAN', 'KHAO_SAT', 'BAO_GIA', 'DAM_PHAN'] as const).map((st) => ({ value: st, label: STAGE_LABEL[st] }))} />
              </ActionForm>
              <p className="mt-3 text-xs text-muted">Giai đoạn &quot;Đã ký&quot; tự cập nhật khi khách đồng ý báo giá hoặc hợp đồng được ký.</p>
              <hr className="my-4 border-line" />
              <ActionForm action={markLost.bind(null, id)} submitLabel="Đánh dấu không thành" size="sm" variant="danger" confirm="Đóng cơ hội này?">
                <Field label="Lý do không thành (bắt buộc)">
                  <Textarea name="reason" rows={2} placeholder="Giá cao hơn đối thủ, khách hoãn dự án..." />
                </Field>
              </ActionForm>
            </Card>
          )}
          <Card title="Khách hàng">
            <DescList items={[['Liên hệ', o.customer.contactName], ['Điện thoại', o.customer.contactPhone], ['Phân khúc', o.customer.industry], ['Khu vực', o.customer.area]]} />
          </Card>
        </div>
      </div>
    </>
  )
}
