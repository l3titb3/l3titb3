'use client'

import { useActionState, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { ActionState } from '@/lib/action'
import { parseNumber } from '@/lib/action'
import { computeTotals, grossMarginPercent, lineAmount, lineCost } from '@/lib/rules/pricing'
import { quoteApprovalLevel } from '@/lib/rules/approval'
import { formatPercent, formatVnd } from '@/lib/rules/money'
import { buttonClass } from './ui'
import { cn } from '@/lib/cn'

export type EditorProduct = { id: string; code: string; name: string; spec: string | null; unit: string; listPrice: number; costPrice: number }
export type EditorSegment = { id: string; name: string; floorMargin: number | null; targetMarginMin: number | null; targetMarginMax: number | null }
export type EditorLine = { productId: string | null; name: string; spec: string; unit: string; quantity: string; unitPrice: string; unitCost: string }
export type EditorInitial = {
  customerId: string
  opportunityId: string
  segmentId: string
  title: string
  quoteDate: string
  vatRate: number
  includesShipping: boolean
  includesInstall: boolean
  warrantyDays: string
  paymentTerms: string
  executionDays: string
  contactName: string
  contactPhone: string
  note: string
  lines: EditorLine[]
}

type Props = {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
  initial: EditorInitial
  customers: Array<{ id: string; label: string }>
  opportunities: Array<{ id: string; label: string; customerId: string; segmentId: string }>
  segments: EditorSegment[]
  products: EditorProduct[]
  vatRates: number[]
  validDays: number
  gdThreshold: number
  submitLabel: string
}

const emptyLine = (): EditorLine => ({ productId: null, name: '', spec: '', unit: '', quantity: '1', unitPrice: '', unitCost: '' })
const n = (v: string) => parseNumber(v) ?? 0
const control = 'w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15'

export function QuoteEditor(props: Props) {
  const [state, formAction, pending] = useActionState(props.action, undefined)
  const [customerId, setCustomerId] = useState(props.initial.customerId)
  const [opportunityId, setOpportunityId] = useState(props.initial.opportunityId)
  const [segmentId, setSegmentId] = useState(props.initial.segmentId)
  const [vatRate, setVatRate] = useState(props.initial.vatRate)
  const [lines, setLines] = useState<EditorLine[]>(props.initial.lines.length ? props.initial.lines : [emptyLine()])

  const segment = props.segments.find((s) => s.id === segmentId)
  const opps = props.opportunities.filter((o) => o.customerId === customerId)
  const priced = lines.map((l) => ({ quantity: n(l.quantity), unitPrice: n(l.unitPrice), unitCost: n(l.unitCost) }))
  const totals = computeTotals(priced, vatRate)
  const approval = segment ? quoteApprovalLevel({ total: totals.total, grossMargin: totals.grossMargin, floorMargin: segment.floorMargin }, { quoteGdThreshold: props.gdThreshold }) : null
  const belowFloor = segment?.floorMargin !== null && segment?.floorMargin !== undefined && totals.subtotal > 0 && totals.grossMargin < segment.floorMargin

  const update = (i: number, patch: Partial<EditorLine>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  const pickProduct = (i: number, productId: string) => {
    const p = props.products.find((x) => x.id === productId)
    if (!p) return update(i, { productId: null })
    update(i, { productId: p.id, name: p.name, spec: p.spec ?? '', unit: p.unit, unitPrice: String(p.listPrice), unitCost: String(p.costPrice) })
  }

  const serialized = JSON.stringify(
    lines.map((l) => ({ productId: l.productId, name: l.name.trim(), spec: l.spec.trim() || null, unit: l.unit.trim(), quantity: n(l.quantity), unitPrice: n(l.unitPrice), unitCost: n(l.unitCost) })),
  )

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="lines" value={serialized} />
      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Labeled label="Khách hàng" required>
          <select name="customerId" value={customerId} onChange={(e) => { setCustomerId(e.target.value); setOpportunityId('') }} className={control} required>
            <option value="">Chọn khách hàng</option>
            {props.customers.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Labeled>
        <Labeled label="Cơ hội liên quan">
          <select
            name="opportunityId"
            value={opportunityId}
            onChange={(e) => {
              setOpportunityId(e.target.value)
              const o = props.opportunities.find((x) => x.id === e.target.value)
              if (o) setSegmentId(o.segmentId)
            }}
            className={control}
          >
            <option value="">Không gắn cơ hội</option>
            {opps.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </Labeled>
        <Labeled label="Mảng kinh doanh" required hint={segment ? (segment.floorMargin !== null ? `Biên LN gộp mục tiêu ${segment.targetMarginMin}-${segment.targetMarginMax}%, sàn ${segment.floorMargin}%` : 'Chưa quy định biên sàn: báo giá trình Giám đốc') : undefined}>
          <select name="segmentId" value={segmentId} onChange={(e) => setSegmentId(e.target.value)} className={control} required>
            <option value="">Chọn mảng</option>
            {props.segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Labeled>
        <Labeled label="Tiêu đề báo giá" className="sm:col-span-2">
          <input name="title" defaultValue={props.initial.title} className={control} placeholder="Ví dụ: Cung cấp cây trang trí sảnh" />
        </Labeled>
        <Labeled label="Ngày báo giá" hint={`Hiệu lực ${props.validDays} ngày kể từ ngày lập`}>
          <input name="quoteDate" type="date" defaultValue={props.initial.quoteDate} className={control} required />
        </Labeled>
      </section>

      <section className="rounded-2xl border border-line bg-white">
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-bold">Hạng mục báo giá</h2>
          <span className="text-xs text-muted">Giá vốn chỉ dùng nội bộ, không in trên báo giá</span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2">Hạng mục (chọn từ danh mục hoặc tự nhập)</th>
                <th className="w-20 px-2 py-2">ĐVT</th>
                <th className="w-20 px-2 py-2">SL</th>
                <th className="w-32 px-2 py-2">Đơn giá</th>
                <th className="w-32 px-2 py-2">Giá vốn</th>
                <th className="w-32 px-2 py-2 text-right">Thành tiền</th>
                <th className="w-16 px-2 py-2 text-right">Biên</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const p = priced[i]
                const amount = lineAmount(p)
                const margin = grossMarginPercent(amount, lineCost(p))
                const low = segment?.floorMargin !== null && segment?.floorMargin !== undefined && amount > 0 && margin < segment.floorMargin
                return (
                  <tr key={i} className="border-t border-line align-top">
                    <td className="space-y-1 px-3 py-2">
                      <select value={l.productId ?? ''} onChange={(e) => pickProduct(i, e.target.value)} className={cn(control, 'text-xs text-muted')} aria-label="Chọn hàng hóa">
                        <option value="">Tự nhập (dịch vụ, nhân công...)</option>
                        {props.products.map((pr) => <option key={pr.id} value={pr.id}>{pr.code} · {pr.name}</option>)}
                      </select>
                      <input value={l.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Tên hạng mục" aria-label="Tên hạng mục" className={control} />
                      <input value={l.spec} onChange={(e) => update(i, { spec: e.target.value })} placeholder="Quy cách: H, D, chậu..." aria-label="Quy cách" className={cn(control, 'text-xs')} />
                    </td>
                    <td className="px-2 py-2"><input value={l.unit} onChange={(e) => update(i, { unit: e.target.value })} aria-label="Đơn vị tính" className={control} /></td>
                    <td className="px-2 py-2"><input value={l.quantity} onChange={(e) => update(i, { quantity: e.target.value })} inputMode="decimal" aria-label="Số lượng" className={cn(control, 'num text-right')} /></td>
                    <td className="px-2 py-2"><input value={l.unitPrice} onChange={(e) => update(i, { unitPrice: e.target.value })} inputMode="numeric" aria-label="Đơn giá" className={cn(control, 'num text-right')} /></td>
                    <td className="px-2 py-2"><input value={l.unitCost} onChange={(e) => update(i, { unitCost: e.target.value })} inputMode="numeric" aria-label="Giá vốn" className={cn(control, 'num text-right')} /></td>
                    <td className="num px-2 py-3 text-right font-semibold">{formatVnd(amount)}</td>
                    <td className={cn('num px-2 py-3 text-right', low ? 'font-semibold text-red-700' : 'text-muted')}>{amount > 0 ? formatPercent(margin) : '-'}</td>
                    <td className="px-2 py-2">
                      <button type="button" aria-label="Xóa dòng" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls))} className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-700">
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-4 border-t border-line px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
          <button type="button" onClick={() => setLines((ls) => [...ls, emptyLine()])} className={buttonClass('ghost', 'sm')}>
            <Plus className="size-4" /> Thêm dòng
          </button>
          <dl className="w-full max-w-sm space-y-1.5 text-sm">
            <Total label="Cộng tiền hàng" value={formatVnd(totals.subtotal)} />
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Thuế GTGT</dt>
              <dd className="flex items-center gap-2">
                <select name="vatRate" value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))} className="rounded-lg border border-line px-2 py-1 text-sm">
                  {props.vatRates.map((r) => <option key={r} value={r}>{r}%</option>)}
                </select>
                <span className="num w-28 text-right">{formatVnd(totals.vatAmount)}</span>
              </dd>
            </div>
            <Total label="Tổng cộng" value={formatVnd(totals.total)} strong />
            <Total label="Giá vốn dự kiến" value={formatVnd(totals.costTotal)} muted />
            <Total label="Biên LN gộp" value={formatPercent(totals.grossMargin)} warn={belowFloor} />
          </dl>
        </div>
        {approval && totals.subtotal > 0 && (
          <div className={cn('mx-5 mb-5 rounded-xl px-4 py-3 text-sm', approval.level === 'GIAM_DOC' ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900')}>
            {approval.level === 'GIAM_DOC' ? (
              <>Báo giá sẽ trình <b>Giám đốc</b> duyệt: {approval.reasons.join('; ')}.</>
            ) : (
              <>Báo giá trong bảng giá chuẩn, biên đạt mức sàn: <b>PGĐ Kinh doanh</b> duyệt.</>
            )}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-2 pt-6 text-sm">
          <label className="inline-flex items-center gap-2"><input type="checkbox" name="includesShipping" defaultChecked={props.initial.includesShipping} className="accent-brand" /> Giá đã gồm vận chuyển</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" name="includesInstall" defaultChecked={props.initial.includesInstall} className="accent-brand" /> Giá đã gồm trồng, lắp đặt</label>
        </div>
        <Labeled label="Bảo hành (ngày)"><input name="warrantyDays" defaultValue={props.initial.warrantyDays} inputMode="numeric" className={control} /></Labeled>
        <Labeled label="Thời gian thực hiện (ngày)"><input name="executionDays" defaultValue={props.initial.executionDays} inputMode="numeric" className={control} /></Labeled>
        <Labeled label="Điều kiện thanh toán" className="sm:col-span-2"><input name="paymentTerms" defaultValue={props.initial.paymentTerms} className={control} placeholder="Ví dụ: Tạm ứng 50%, thanh toán phần còn lại sau nghiệm thu" /></Labeled>
        <Labeled label="Người liên hệ (phía công ty)"><input name="contactName" defaultValue={props.initial.contactName} className={control} /></Labeled>
        <Labeled label="Điện thoại liên hệ"><input name="contactPhone" defaultValue={props.initial.contactPhone} className={control} /></Labeled>
        <Labeled label="Ghi chú nội bộ" className="sm:col-span-2"><textarea name="note" defaultValue={props.initial.note} rows={2} className={control} /></Labeled>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass('primary')}>{pending ? 'Đang lưu...' : props.submitLabel}</button>
        {state?.error && <p role="alert" className="text-sm font-medium text-red-700">{state.error}</p>}
      </div>
    </form>
  )
}

function Labeled({ label, required, hint, className, children }: { label: string; required?: boolean; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-sm font-medium">{label}{required && <span className="text-red-600"> *</span>}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

function Total({ label, value, strong, muted, warn }: { label: string; value: string; strong?: boolean; muted?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={muted ? 'text-muted' : ''}>{label}</dt>
      <dd className={cn('num', strong && 'text-base font-bold', muted && 'text-muted', warn && 'font-semibold text-red-700')}>{value}</dd>
    </div>
  )
}
