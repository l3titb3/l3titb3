import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { getCompany } from '@/lib/settings'
import { getDashboard } from '@/lib/queries/dashboard'
import { BarList, Card, DataBadge, PageHeader, RuleBadge, Stat } from '@/components/ui'
import { formatPercent, formatVnd, formatVndShort } from '@/lib/rules/money'
import { formatDate, formatInstantDate } from '@/lib/rules/dates'
import { AGING_ACTION, AGING_LABEL } from '@/lib/rules/aging'
import { ACTIVITY_LABEL, SIGNER_LABEL, STAGE_LABEL } from '@/lib/labels'

export const metadata = { title: 'Tổng quan' }

export default async function DashboardPage() {
  const user = await requireUser()
  const [company, d] = await Promise.all([getCompany(), getDashboard(user)])
  const demo = company.demoData
  const overLimit = d.aging.over30Ratio > company.overdueRatioLimit
  const maxMonth = Math.max(1, ...d.months.map((m) => m.value))
  const dq = d.dataQuality

  const todoCount =
    d.todo.myTasks.length + d.todo.pendingQuotes.length + d.todo.pendingContracts.length + d.todo.expiringQuotes.length + d.todo.endingContracts.length + d.todo.newLeads.length

  return (
    <>
      <PageHeader
        title={`Chào ${user.name}`}
        description={`${user.title} · Hôm nay ${formatDate(d.today)}${user.role === 'NV_KINH_DOANH' ? ' · Số liệu theo khách hàng anh/chị phụ trách' : ''}`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Tiền đã thu tháng này" value={formatVndShort(d.cashThisMonth)} hint="Tổng phiếu thu, gồm VAT" />
        <Stat
          label="Hợp đồng mới ký tháng này"
          value={formatVndShort(d.contractsThisMonth.total)}
          hint={`${d.contractsThisMonth.count} hợp đồng, giá trị gồm VAT`}
        />
        <Stat label="Cơ hội đang theo" value={formatVndShort(d.pipeline.value)} hint={`${d.pipeline.count} cơ hội, giá trị dự kiến`} />
        <Stat
          label="Nợ quá hạn trên 30 ngày"
          value={formatPercent(d.aging.over30Ratio)}
          tone={overLimit ? 'bad' : d.aging.over30 > 0 ? 'warn' : 'good'}
          hint={`Ngưỡng ${formatPercent(company.overdueRatioLimit, 0)} tổng nợ phải thu (Điều 9a)`}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card title="Việc cần xử lý" badge={<DataBadge demo={demo} />} className="xl:col-span-3">
          {todoCount === 0 ? (
            <p className="text-sm text-muted">Không có việc tồn đọng.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {d.todo.pendingQuotes.map((q) => (
                <TodoRow key={q.id} href={`/bao-gia/${q.id}`} tag="Duyệt báo giá" tone="indigo" title={`${q.number} · ${q.customer.name}`} meta={`${formatVnd(q.total)} đ`} />
              ))}
              {d.todo.pendingContracts.map((c) => (
                <TodoRow
                  key={c.id}
                  href={`/hop-dong/${c.id}`}
                  tag={c.reviewedAt ? `Phê duyệt (${SIGNER_LABEL[c.signerLevel]})` : 'Rà soát hợp đồng'}
                  tone="indigo"
                  title={`${c.number} · ${c.customer.name}`}
                  meta={`${formatVnd(c.total)} đ`}
                />
              ))}
              {d.todo.newLeads.map((o) => (
                <TodoRow key={o.id} href={`/co-hoi/${o.id}`} tag="Chưa phản hồi khách" tone="red" title={`${o.title} · ${o.customer.name}`} meta={`Nhận ${formatInstantDate(o.receivedAt)}`} />
              ))}
              {d.todo.myTasks.map((t) => (
                <TodoRow
                  key={t.id}
                  href={`/khach-hang/${t.customer.id}`}
                  tag={ACTIVITY_LABEL[t.type]}
                  tone={t.dueAt && t.dueAt < new Date() ? 'orange' : 'gray'}
                  title={`${t.subject} · ${t.customer.name}`}
                  meta={`Hạn ${formatInstantDate(t.dueAt)}`}
                />
              ))}
              {d.todo.expiringQuotes.map((q) => (
                <TodoRow key={q.id} href={`/bao-gia/${q.id}`} tag="Báo giá sắp hết hiệu lực" tone="orange" title={`${q.number} · ${q.customer.name}`} meta={`Đến ${formatDate(q.validUntil)}`} />
              ))}
              {d.todo.endingContracts.map((c) => (
                <TodoRow key={c.id} href={`/hop-dong/${c.id}`} tag="Nhắc tái ký" tone="orange" title={`${c.number} · ${c.customer.name}`} meta={`Hết hạn ${formatDate(c.endDate)}`} />
              ))}
            </ul>
          )}
          <div className="mt-3 text-right text-sm">
            <Link href="/viec-can-lam" className="font-semibold text-brand hover:underline">
              Xem tất cả việc cần làm →
            </Link>
          </div>
        </Card>

        <Card title="Công nợ phải thu" badge={<RuleBadge />} className="xl:col-span-2">
          <div className="mb-4 flex items-baseline justify-between">
            <span className="text-sm text-muted">Tổng còn phải thu</span>
            <span className="num text-xl font-bold">{formatVnd(d.aging.totalOutstanding)} đ</span>
          </div>
          <BarList
            items={(['TRONG_HAN', 'QH_1_30', 'QH_31_60', 'QH_61_90', 'QH_TREN_90'] as const).map((b) => ({
              label: AGING_LABEL[b],
              value: d.aging[b],
              display: formatVndShort(d.aging[b]),
              gap: b !== 'TRONG_HAN',
              href: '/cong-no',
            }))}
            emptyText="Chưa có công nợ phải thu"
          />
          <ul className="mt-4 space-y-1 text-xs text-muted">
            <li>Quá hạn trên 30 ngày: {AGING_ACTION.QH_31_60?.toLowerCase()}.</li>
            <li>Quá hạn trên 60 ngày: gửi thông báo đòi nợ bằng văn bản. Trên 90 ngày: Giám đốc quyết định.</li>
            {d.dueSoon > 0 && <li className="font-semibold text-gap">{d.dueSoon} khoản đến hạn trong 3 ngày tới: nhắc khách trước hạn.</li>}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Tiền thu 6 tháng gần nhất" badge={<DataBadge demo={demo} />}>
          <div className="flex h-48 items-end gap-3">
            {d.months.map((m) => (
              <div key={m.key} className="flex flex-1 flex-col items-center gap-2">
                <span className="num text-[11px] text-muted">{m.value > 0 ? formatVndShort(m.value) : ''}</span>
                <div className="flex h-32 w-full items-end">
                  <div className="w-full rounded-t-lg bg-brand" style={{ height: `${Math.max(m.value > 0 ? 3 : 0, (m.value / maxMonth) * 100)}%` }} />
                </div>
                <span className="text-xs font-medium text-ink">{m.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Phễu bán hàng" badge={<DataBadge demo={demo} />}>
          <BarList
            items={d.pipeline.funnel.map((f) => ({
              label: `${STAGE_LABEL[f.stage]} (${f.count})`,
              value: f.value,
              display: formatVndShort(f.value),
              href: `/co-hoi?giai-doan=${f.stage}`,
            }))}
            emptyText="Chưa có cơ hội đang theo"
          />
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-zinc-50 px-3 py-2">
              <div className="text-xs text-muted">Tỷ lệ chuyển đổi báo giá (năm)</div>
              <div className="num font-bold">{d.conversion.rate === null ? 'Chưa đủ dữ liệu' : `${formatPercent(d.conversion.rate)} (${d.conversion.won}/${d.conversion.won + d.conversion.lost})`}</div>
            </div>
            <div className="rounded-xl bg-zinc-50 px-3 py-2">
              <div className="text-xs text-muted">Biên LN gộp báo giá đã thắng</div>
              <div className="num font-bold">{d.wonMargin === null ? 'Chưa đủ dữ liệu' : formatPercent(d.wonMargin)}</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Hợp đồng đã ký trong năm" badge={<DataBadge demo={demo} />}>
          <h3 className="mb-3 text-sm font-bold">Theo mảng kinh doanh</h3>
          <BarList items={d.bySegment.map((s) => ({ label: s.label, value: s.value, display: formatVndShort(s.value) }))} emptyText="Chưa có hợp đồng trong năm" />
          <h3 className="mb-3 mt-6 text-sm font-bold">Theo người phụ trách</h3>
          <BarList items={d.byOwner.map((s) => ({ label: s.label, value: s.value, display: formatVndShort(s.value), gap: s.label.startsWith('Chưa') }))} emptyText="Chưa có hợp đồng trong năm" />
          <p className="mt-3 text-xs text-muted">Giá trị chưa VAT.</p>
        </Card>

        <Card title="Chất lượng dữ liệu khách hàng" badge={<DataBadge demo={demo} />}>
          <p className="mb-4 text-sm text-muted">
            {dq.total} khách hàng. Thanh màu cam là phần còn thiếu thông tin, cần bổ sung để báo cáo đúng.
          </p>
          <h3 className="mb-3 text-sm font-bold">Theo trạng thái</h3>
          <BarList
            items={[
              { label: 'Đang giao dịch', value: dq.byStatus.DANG_GIAO_DICH },
              { label: 'Tiềm năng', value: dq.byStatus.TIEM_NANG },
              { label: 'Ngừng giao dịch', value: dq.byStatus.NGUNG },
            ]}
          />
          <h3 className="mb-3 mt-6 text-sm font-bold">Thông tin còn thiếu</h3>
          <BarList
            items={[
              { label: 'Chưa giao người phụ trách', value: dq.noOwner, gap: true },
              { label: 'Chưa ghi phân khúc', value: dq.noIndustry, gap: true },
              { label: 'Chưa ghi kênh tiếp nhận', value: dq.noSource, gap: true },
              { label: 'Chưa có số điện thoại', value: dq.noPhone, gap: true },
              { label: `Tổ chức chưa có MST (${dq.orgs})`, value: dq.orgNoTax, gap: true },
            ]}
            emptyText="Dữ liệu khách hàng đầy đủ"
          />
        </Card>
      </div>
    </>
  )
}

function TodoRow({ href, tag, tone, title, meta }: { href: string; tag: string; tone: 'indigo' | 'orange' | 'red' | 'gray'; title: string; meta: string }) {
  const tones = { indigo: 'bg-brand-soft text-brand', orange: 'bg-orange-50 text-orange-700', red: 'bg-red-50 text-red-700', gray: 'bg-zinc-100 text-zinc-700' }
  return (
    <li>
      <Link href={href} className="flex flex-col gap-1 py-2.5 hover:bg-zinc-50 sm:flex-row sm:items-center sm:gap-3">
        <span className={`w-fit shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{tag}</span>
        <span className="min-w-0 flex-1 truncate text-ink">{title}</span>
        <span className="num shrink-0 text-xs text-muted">{meta}</span>
      </Link>
    </li>
  )
}
