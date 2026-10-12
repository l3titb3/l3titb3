import Link from 'next/link'
import type { ContractStatus, ContractType, Prisma } from '@prisma/client'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can, contractScope } from '@/lib/permissions'
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Table, Td, Th } from '@/components/ui'
import { Input, Select } from '@/components/form'
import { CONTRACT_STATUS_LABEL, CONTRACT_TYPE_SHORT, SIGNER_LABEL } from '@/lib/labels'
import { formatVnd } from '@/lib/rules/money'
import { addDays, formatDate, todayVN } from '@/lib/rules/dates'
import { contractsAwaiting } from '@/lib/queries/nav'
import { contractStatusTone } from '@/lib/tones'
import { outstanding } from '@/lib/rules/aging'

export const metadata = { title: 'Hợp đồng' }

export default async function ContractsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser()
  const sp = await searchParams
  const awaiting = contractsAwaiting(user)
  const filters: Prisma.ContractWhereInput[] = [contractScope(user)]
  if (sp.status === 'cho-toi' && awaiting) filters.push(awaiting)
  else if (sp.status === 'sap-het-han') filters.push({ status: 'DA_KY', endDate: { not: null, lte: addDays(todayVN(), 30) } })
  else if (sp.status) filters.push({ status: sp.status as ContractStatus })
  if (sp.type) filters.push({ type: sp.type as ContractType })
  if (sp.q) filters.push({ OR: [{ number: { contains: sp.q } }, { projectCode: { contains: sp.q } }, { title: { contains: sp.q, mode: 'insensitive' } }, { customer: { name: { contains: sp.q, mode: 'insensitive' } } }] })
  const contracts = await prisma.contract.findMany({
    where: { AND: filters },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { customer: { select: { name: true } }, owner: { select: { name: true } }, receivables: { select: { amount: true, paidAmount: true } } },
  })
  return (
    <>
      <PageHeader title="Hợp đồng" description="Hợp đồng bán ra theo bộ mẫu 03.1 - 03.4, 03.9; mã công trình theo Quy chế phân bổ lợi nhuận." actions={can.sell(user) && <ButtonLink href="/hop-dong/moi">+ Lập hợp đồng</ButtonLink>} />
      <Card>
        <form method="get" className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_13rem_13rem_auto]">
          <Input name="q" defaultValue={sp.q} placeholder="Tìm theo số hợp đồng, mã công trình, khách hàng" />
          <Select
            name="status"
            defaultValue={sp.status ?? ''}
            placeholder="Mọi trạng thái"
            options={[...(awaiting ? [{ value: 'cho-toi', label: 'Chờ tôi xử lý' }] : []), { value: 'sap-het-han', label: 'Sắp hết hạn (30 ngày)' }, ...Object.entries(CONTRACT_STATUS_LABEL).map(([value, label]) => ({ value, label }))]}
          />
          <Select name="type" defaultValue={sp.type ?? ''} placeholder="Mọi loại" options={Object.entries(CONTRACT_TYPE_SHORT).map(([value, label]) => ({ value, label }))} />
          <button className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50">Lọc</button>
        </form>
        {contracts.length === 0 ? (
          <EmptyState title="Chưa có hợp đồng" />
        ) : (
          <Table>
            <thead>
              <tr><Th>Số hợp đồng</Th><Th>Khách hàng, nội dung</Th><Th>Ngày ký, thời hạn</Th><Th>Cấp ký</Th><Th className="text-right">Giá trị gồm VAT</Th><Th className="text-right">Còn phải thu</Th><Th>Trạng thái</Th></tr>
            </thead>
            <tbody>
              {contracts.map((c) => {
                const debt = c.receivables.reduce((s, r) => s + outstanding(r), 0)
                return (
                  <tr key={c.id} className="hover:bg-zinc-50">
                    <Td>
                      <Link href={`/hop-dong/${c.id}`} className="num whitespace-nowrap font-semibold hover:text-brand">{c.number}</Link>
                      {c.projectCode && <div className="num text-xs text-muted">{c.projectCode}</div>}
                    </Td>
                    <Td>{c.customer.name}<div className="text-xs text-muted">{CONTRACT_TYPE_SHORT[c.type]} · {c.title}</div></Td>
                    <Td className="whitespace-nowrap">{formatDate(c.signDate)}{c.endDate && <div className="text-xs text-muted">đến {formatDate(c.endDate)}</div>}</Td>
                    <Td>{SIGNER_LABEL[c.signerLevel]}</Td>
                    <Td className="num text-right">{formatVnd(c.total)}</Td>
                    <Td className="num text-right">{debt > 0 ? formatVnd(debt) : '-'}</Td>
                    <Td><Badge tone={contractStatusTone(c.status)}>{CONTRACT_STATUS_LABEL[c.status]}</Badge></Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  )
}
