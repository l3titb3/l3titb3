/**
 * Khởi tạo dữ liệu.
 *   npm run db:seed        -> thông tin công ty, mảng kinh doanh, 05 tài khoản người dùng
 *   npm run db:seed:demo   -> thêm dữ liệu mẫu để chạy thử (KHÔNG dùng cho dữ liệu thật)
 * Mật khẩu ban đầu: biến môi trường SEED_PASSWORD, nếu không có thì sinh ngẫu nhiên và in ra màn hình.
 */
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { PrismaClient, type ContractType, type Prisma, type Role } from '@prisma/client'
import { computeTotals, lineAmount, lineCost, priceFromCost } from '../src/lib/rules/pricing'
import { addDays, addWorkingDays, todayVN, dateOnlyToInstant } from '../src/lib/rules/dates'
import { contractSignerLevel, needsProjectCode, quoteApprovalLevel } from '../src/lib/rules/approval'
import {
  COUNTER_KEYS,
  formatContractNumber,
  formatCustomerCode,
  formatOpportunityCode,
  formatProjectCode,
  formatQuoteNumber,
} from '../src/lib/rules/numbering'

const prisma = new PrismaClient()
const demo = process.argv.includes('--demo')

async function seq(tx: Prisma.TransactionClient, key: string) {
  const c = await tx.counter.upsert({ where: { key }, create: { key, value: 1 }, update: { value: { increment: 1 } } })
  return c.value
}

async function seedBase() {
  await prisma.companySetting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'CÔNG TY TNHH LÂM MỘC THẢO',
      shortName: 'LMT',
      taxCode: '4202065455',
      address: '06B/1 Phan Đình Giót, phường Tây Nha Trang, tỉnh Khánh Hòa',
      phone: '0963 789 535',
      email: 'congtytnhhlammocthao@gmail.com',
      legalRep: 'Phạm Quyền',
      legalRepTitle: 'Chủ tịch Hội đồng thành viên',
      director: 'Trần Quyết Chiến',
    },
  })

  // QT-KD-01 mục 3 (biên LN gộp mục tiêu; mức sàn thấp hơn cận dưới mục tiêu 10 điểm %)
  // và Quy chế phân bổ lợi nhuận Điều 4, Điều 5
  const segments: Prisma.SegmentCreateInput[] = [
    { id: 'BAN_LE', name: 'Bán lẻ cây, chậu', sortOrder: 1, targetMarginMin: 40, targetMarginMax: 50, floorMargin: 30, allocatesProfit: false },
    { id: 'BAN_BUON', name: 'Bán buôn cây, vật tư (đơn lớn)', sortOrder: 2, targetMarginMin: 20, targetMarginMax: 30, floorMargin: 10, allocatesProfit: true, projectCodeMinValue: 50_000_000, contributionFloor: 10, bonusRate: 10 },
    { id: 'CHO_THUE', name: 'Cho thuê cây', sortOrder: 3, targetMarginMin: 55, targetMarginMax: 65, floorMargin: 45, allocatesProfit: true, projectCodeMinValue: 20_000_000, contributionFloor: 25, bonusRate: 10, note: 'Biên tính trên vòng đời cây' },
    { id: 'CHAM_SOC', name: 'Chăm sóc, bảo trì cây xanh', sortOrder: 4, targetMarginMin: 35, targetMarginMax: 45, floorMargin: 25, allocatesProfit: true, projectCodeMinValue: 20_000_000, contributionFloor: 20, bonusRate: 10 },
    { id: 'THI_CONG', name: 'Thi công cảnh quan', sortOrder: 5, targetMarginMin: 25, targetMarginMax: 35, floorMargin: 15, allocatesProfit: true, projectCodeMinValue: 20_000_000, contributionFloor: 15, bonusRate: 15 },
    { id: 'VSMT', name: 'Vệ sinh môi trường, duy trì cảnh quan', sortOrder: 6, allocatesProfit: true, projectCodeMinValue: 20_000_000, contributionFloor: 12, bonusRate: 10, note: 'QT-KD-01 chưa quy định biên LN gộp mục tiêu' },
    { id: 'HA_TANG', name: 'Xây dựng hạ tầng, công trình phụ trợ cảnh quan', sortOrder: 7, allocatesProfit: true, projectCodeMinValue: 20_000_000, contributionFloor: 10, bonusRate: 12, note: 'QT-KD-01 chưa quy định biên LN gộp mục tiêu' },
  ]
  for (const s of segments) {
    await prisma.segment.upsert({ where: { id: s.id }, update: {}, create: s })
  }

  if ((await prisma.user.count()) > 0) {
    console.log('Đã có tài khoản người dùng, bỏ qua bước tạo tài khoản.')
    return
  }

  // Cơ cấu theo Danh mục hồ sơ v3.0: Ban Giám đốc 03 người, Phòng HCKT, Phòng KD
  const users: Array<{ email: string; name: string; title: string; role: Role; isChairman?: boolean }> = [
    { email: 'giamdoc@lammocthao.local', name: 'Trần Quyết Chiến', title: 'Giám đốc', role: 'GIAM_DOC' },
    { email: 'pgd.kinhdoanh@lammocthao.local', name: 'Long', title: 'PGĐ phụ trách Kinh doanh', role: 'PGD_KINH_DOANH' },
    { email: 'pgd.kythuat@lammocthao.local', name: 'Phạm Quyền', title: 'Chủ tịch HĐTV, kiêm PGĐ phụ trách Kỹ thuật - Thi công', role: 'PGD_KY_THUAT', isChairman: true },
    { email: 'ketoan@lammocthao.local', name: 'Kế toán tổng hợp', title: 'Kế toán tổng hợp - Phòng HCKT', role: 'KE_TOAN' },
    { email: 'kinhdoanh@lammocthao.local', name: 'Nhân viên kinh doanh', title: 'Nhân viên kinh doanh', role: 'NV_KINH_DOANH' },
  ]
  const fixed = process.env.SEED_PASSWORD
  console.log('\nTài khoản đăng nhập (đổi mật khẩu ở lần đăng nhập đầu tiên):')
  for (const u of users) {
    const password = fixed ?? randomBytes(6).toString('base64url')
    await prisma.user.create({
      data: { ...u, isChairman: u.isChairman ?? false, passwordHash: await bcrypt.hash(password, 10), mustChangePassword: !fixed },
    })
    console.log(`  ${u.title.padEnd(55)} ${u.email.padEnd(34)} ${fixed ? '(SEED_PASSWORD)' : password}`)
  }
  console.log('')
}

async function seedDemo() {
  if ((await prisma.customer.count()) > 0) {
    console.log('Đã có khách hàng, không thêm dữ liệu mẫu.')
    return
  }
  const company = await prisma.companySetting.findUniqueOrThrow({ where: { id: 1 } })
  const segments = Object.fromEntries((await prisma.segment.findMany()).map((s) => [s.id, s]))
  const byRole = async (role: Role) => (await prisma.user.findFirstOrThrow({ where: { role } })).id
  const gd = await byRole('GIAM_DOC')
  const pgdkd = await byRole('PGD_KINH_DOANH')
  const pgdkt = await byRole('PGD_KY_THUAT')
  const kt = await byRole('KE_TOAN')
  const nv = await byRole('NV_KINH_DOANH')
  const today = todayVN()
  const at = (daysAgo: number, hour = 9) => new Date(dateOnlyToInstant(addDays(today, -daysAgo)).getTime() + hour * 3600_000)

  // Danh mục mẫu lấy từ file 04.3; giá bán chuẩn tạm tính = giá vốn / (1 - biên mục tiêu)
  const products = [
    { code: 'CC-KT35', name: 'Kim tiền chậu sứ 35', group: 'CC', spec: 'H 0,8-1,0 m', unit: 'Chậu', costPrice: 280_000, margin: 45 },
    { code: 'CC-TBDV30', name: 'Trầu bà đế vương chậu 30', group: 'CC', spec: 'H 0,7-0,8 m', unit: 'Chậu', costPrice: 220_000, margin: 45 },
    { code: 'CX-LV35', name: 'Lộc vừng', group: 'CX', spec: 'H 3-3,5 m; Dg 15-18 cm', unit: 'Cây', costPrice: 2_500_000, margin: 30 },
    { code: 'CB-CLG', name: 'Cỏ lá gừng', group: 'CB', spec: 'Tấm', unit: 'm2', costPrice: 35_000, margin: 30 },
    { code: 'CH-COMP40', name: 'Chậu composite tròn 40', group: 'CH', spec: 'D40 x H40', unit: 'Cái', costPrice: 350_000, margin: 45 },
    { code: 'VT-DS50', name: 'Đất sạch trộn sẵn bao 50 dm3', group: 'VT', spec: 'Bao', unit: 'Bao', costPrice: 60_000, margin: 40 },
  ]
  const productIds: Record<string, string> = {}
  for (const p of products) {
    const { margin, ...data } = p
    const created = await prisma.product.create({
      data: { ...data, listPrice: priceFromCost(p.costPrice, margin), note: 'Dữ liệu mẫu từ file 04.3' },
    })
    productIds[p.code] = created.id
  }

  type DemoCustomer = Omit<Prisma.CustomerUncheckedCreateInput, 'code' | 'createdById'>
  const customers: DemoCustomer[] = [
    { name: 'Chủ nhà biệt thự A', type: 'CA_NHAN', industry: 'Biệt thự, nhà ở', source: 'Giới thiệu', area: 'Nha Trang', contactName: 'Anh A', contactPhone: '0900 000 001', ownerId: nv, status: 'DANG_GIAO_DICH' },
    { name: 'Khách sạn B', type: 'TO_CHUC', industry: 'Khách sạn', source: 'Chủ động tiếp cận', area: 'Nha Trang', taxCode: '0000000002', contactName: 'Chị B - Trưởng bộ phận buồng', contactPhone: '0900 000 002', ownerId: nv, creditLimit: 30_000_000, paymentTermDays: 10, status: 'DANG_GIAO_DICH' },
    { name: 'Resort C', type: 'TO_CHUC', industry: 'Resort', source: 'Giới thiệu', area: 'Cam Ranh', taxCode: '0000000003', contactName: 'Anh C - Quản lý cảnh quan', contactPhone: '0900 000 003', ownerId: pgdkd, creditLimit: 30_000_000, paymentTermDays: 10, status: 'DANG_GIAO_DICH' },
    { name: 'Văn phòng D', type: 'TO_CHUC', industry: 'Tòa nhà văn phòng', source: 'Fanpage', area: 'Nha Trang', taxCode: '0000000004', contactName: 'Chị D - Hành chính', contactPhone: '0900 000 004', ownerId: nv, creditLimit: 20_000_000, paymentTermDays: 15, status: 'DANG_GIAO_DICH' },
    { name: 'Quán cà phê E', type: 'CA_NHAN', industry: 'Quán cà phê', source: 'Zalo', area: 'Nha Trang', contactName: 'Anh E', contactPhone: '0900 000 005', ownerId: nv },
    { name: 'Trường học F', type: 'TO_CHUC', industry: 'Trường học', source: 'Chủ động tiếp cận', area: 'Diên Khánh', contactName: 'Thầy F - Phó hiệu trưởng', ownerId: pgdkd },
    { name: 'Khu đô thị G', type: 'TO_CHUC', industry: 'Khu đô thị', source: 'Mời thầu', area: 'Cam Lâm', taxCode: '0000000007', contactName: 'Ban quản lý G', ownerId: pgdkd },
    { name: 'Nhà hàng H', type: 'TO_CHUC', source: 'TikTok', area: 'Nha Trang', contactName: 'Chị H', contactPhone: '0900 000 008' },
  ]
  const customerIds: string[] = []
  for (const c of customers) {
    const s = await prisma.$transaction((tx) => seq(tx, COUNTER_KEYS.customer()))
    const created = await prisma.customer.create({ data: { ...c, code: formatCustomerCode(s), createdById: gd, createdAt: at(40) } })
    customerIds.push(created.id)
  }
  const [cA, cB, cC, cD, cE, cF, cG, cH] = customerIds

  const year = today.getUTCFullYear()
  async function opportunity(data: Omit<Prisma.OpportunityUncheckedCreateInput, 'code' | 'createdById'>) {
    const s = await prisma.$transaction((tx) => seq(tx, COUNTER_KEYS.opportunity(year)))
    return prisma.opportunity.create({ data: { ...data, code: formatOpportunityCode(s, year), createdById: data.ownerId ?? gd } })
  }

  const oA = await opportunity({ title: 'Sân vườn biệt thự A', customerId: cA, segmentId: 'THI_CONG', stage: 'THANG', expectedValue: 180_000_000, ownerId: nv, source: 'Giới thiệu', receivedAt: at(60), firstContactAt: at(60, 9.1), closedAt: at(50) })
  const oB = await opportunity({ title: 'Cho thuê cây sảnh, hành lang khách sạn B', customerId: cB, segmentId: 'CHO_THUE', stage: 'THANG', expectedValue: 36_000_000, ownerId: nv, receivedAt: at(45), firstContactAt: at(45, 9.2), closedAt: at(40) })
  const oC = await opportunity({ title: 'Chăm sóc cảnh quan Resort C (12 tháng)', customerId: cC, segmentId: 'CHAM_SOC', stage: 'THANG', expectedValue: 45_000_000, ownerId: pgdkd, receivedAt: at(44), firstContactAt: at(44, 10), closedAt: at(38) })
  const oD = await opportunity({ title: 'Cây văn phòng tầng 3-5 Văn phòng D', customerId: cD, segmentId: 'BAN_BUON', stage: 'THANG', expectedValue: 60_000_000, ownerId: nv, source: 'Fanpage', receivedAt: at(25), firstContactAt: at(25, 9.15), closedAt: at(18) })
  const oE = await opportunity({ title: 'Cây trang trí quán cà phê E', customerId: cE, segmentId: 'BAN_LE', stage: 'BAO_GIA', needsSurvey: false, expectedValue: 12_000_000, ownerId: nv, source: 'Zalo', receivedAt: at(4), firstContactAt: at(4, 9.1) })
  const oF = await opportunity({ title: 'Cải tạo sân trường F', customerId: cF, segmentId: 'THI_CONG', stage: 'KHAO_SAT', expectedValue: 250_000_000, expectedCloseDate: addDays(today, 30), ownerId: pgdkd, receivedAt: at(3), firstContactAt: at(3, 10) })
  const oG = await opportunity({ title: 'Duy trì cảnh quan khu đô thị G', customerId: cG, segmentId: 'VSMT', stage: 'DAM_PHAN', expectedValue: 600_000_000, expectedCloseDate: addDays(today, 20), ownerId: pgdkd, source: 'Mời thầu', receivedAt: at(15), firstContactAt: at(15, 11) })
  await opportunity({ title: 'Cây trang trí nhà hàng H', customerId: cH, segmentId: 'BAN_LE', stage: 'TIEP_NHAN', needsSurvey: false, expectedValue: 8_000_000, source: 'TikTok', receivedAt: new Date(Date.now() - 50 * 60000) })

  await prisma.survey.create({
    data: {
      opportunityId: oF.id, surveyDate: addDays(today, -1), surveyorId: pgdkt, location: 'Sân trường F', needs: ['Thi công'],
      areaSize: 'Khoảng 600 m2 sân chính và bồn hoa', light: 'Nắng trực tiếp cả ngày', soilDrainage: 'Đất cát pha, thoát nước kém góc phía Tây',
      waterPower: 'Có nước máy, điện 1 pha', access: 'Xe tải 2,5 tấn vào được cổng phụ', styleBudget: 'Bóng mát, dễ chăm sóc', risks: 'Gió biển, hơi mặn',
    },
  })

  async function quote(input: {
    customerId: string; opportunityId?: string; segmentId: string; createdById: string; status: Prisma.QuoteUncheckedCreateInput['status']
    daysAgo: number; lines: Array<{ code?: string; name: string; spec?: string; unit: string; quantity: number; unitPrice: number; unitCost: number }>
    title?: string; approvedById?: string
  }) {
    const totals = computeTotals(input.lines, company.defaultVatRate)
    const approval = quoteApprovalLevel({ total: totals.total, grossMargin: totals.grossMargin, floorMargin: segments[input.segmentId].floorMargin }, company)
    const s = await prisma.$transaction((tx) => seq(tx, COUNTER_KEYS.quote(year)))
    const quoteDate = addDays(today, -input.daysAgo)
    const submitted = input.status !== 'NHAP'
    const approved = ['DA_DUYET', 'DA_GUI', 'THANG'].includes(input.status as string)
    return prisma.quote.create({
      data: {
        number: formatQuoteNumber(s, year), year, seq: s, customerId: input.customerId, opportunityId: input.opportunityId, segmentId: input.segmentId,
        title: input.title, quoteDate, validUntil: addDays(quoteDate, company.quoteValidDays), status: input.status, vatRate: company.defaultVatRate,
        includesShipping: true, includesInstall: true, warrantyDays: 30, paymentTerms: 'Tạm ứng 50%, thanh toán phần còn lại sau nghiệm thu', executionDays: 10,
        ...totals, approvalLevel: submitted ? approval.level : null, approvalReasons: submitted ? approval.reasons : [],
        submittedAt: submitted ? at(input.daysAgo) : null,
        approvedById: approved ? (input.approvedById ?? (approval.level === 'GIAM_DOC' ? gd : pgdkd)) : null,
        approvedAt: approved ? at(input.daysAgo, 14) : null,
        sentAt: ['DA_GUI', 'THANG'].includes(input.status as string) ? at(input.daysAgo, 15) : null,
        closedAt: input.status === 'THANG' ? at(Math.max(0, input.daysAgo - 3)) : null,
        createdById: input.createdById,
        lines: {
          create: input.lines.map((l, i) => ({
            sortOrder: i, productId: l.code ? productIds[l.code] : null, name: l.name, spec: l.spec, unit: l.unit, quantity: l.quantity,
            unitPrice: l.unitPrice, unitCost: l.unitCost, amount: lineAmount(l), costAmount: lineCost(l),
          })),
        },
      },
    })
  }

  const qA = await quote({ customerId: cA, opportunityId: oA.id, segmentId: 'THI_CONG', createdById: nv, status: 'THANG', daysAgo: 55, title: 'Thi công sân vườn biệt thự', lines: [
    { code: 'CX-LV35', name: 'Lộc vừng', spec: 'H 3-3,5 m; Dg 15-18 cm', unit: 'Cây', quantity: 12, unitPrice: 4_200_000, unitCost: 2_500_000 },
    { code: 'CB-CLG', name: 'Cỏ lá gừng', spec: 'Tấm', unit: 'm2', quantity: 900, unitPrice: 78_000, unitCost: 35_000 },
    { name: 'Nhân công trồng, hoàn thiện mặt bằng', unit: 'Gói', quantity: 1, unitPrice: 59_400_000, unitCost: 52_000_000 },
  ] })
  const qB = await quote({ customerId: cB, opportunityId: oB.id, segmentId: 'CHO_THUE', createdById: nv, status: 'THANG', daysAgo: 42, title: 'Cho thuê cây 12 tháng', lines: [
    { code: 'CC-KT35', name: 'Thuê cây Kim tiền chậu sứ 35 (12 tháng)', unit: 'Chậu', quantity: 20, unitPrice: 1_800_000, unitCost: 700_000 },
  ] })
  const qD = await quote({ customerId: cD, opportunityId: oD.id, segmentId: 'BAN_BUON', createdById: nv, status: 'THANG', daysAgo: 20, lines: [
    { code: 'CC-KT35', name: 'Kim tiền chậu sứ 35', spec: 'H 0,8-1,0 m', unit: 'Chậu', quantity: 60, unitPrice: 520_000, unitCost: 280_000 },
    { code: 'CC-TBDV30', name: 'Trầu bà đế vương chậu 30', spec: 'H 0,7-0,8 m', unit: 'Chậu', quantity: 60, unitPrice: 480_000, unitCost: 220_000 },
  ] })
  await quote({ customerId: cE, opportunityId: oE.id, segmentId: 'BAN_LE', createdById: nv, status: 'CHO_DUYET', daysAgo: 1, lines: [
    { code: 'CC-KT35', name: 'Kim tiền chậu sứ 35', spec: 'H 0,8-1,0 m', unit: 'Chậu', quantity: 10, unitPrice: 480_000, unitCost: 280_000 },
    { code: 'CH-COMP40', name: 'Chậu composite tròn 40', spec: 'D40 x H40', unit: 'Cái', quantity: 6, unitPrice: 600_000, unitCost: 350_000 },
  ] })
  await quote({ customerId: cG, opportunityId: oG.id, segmentId: 'VSMT', createdById: pgdkd, status: 'DA_GUI', daysAgo: 6, title: 'Duy trì cảnh quan, thu gom rác khuôn viên 12 tháng', lines: [
    { name: 'Duy trì cảnh quan, vệ sinh khuôn viên', unit: 'Tháng', quantity: 12, unitPrice: 50_000_000, unitCost: 41_000_000 },
  ] })

  async function contract(input: {
    type: ContractType; customerId: string; quoteId?: string; segmentId: string; title: string; value: number; ownerId: string
    signedDaysAgo: number; months?: number; advancePercent?: number; status: 'DA_KY' | 'HOAN_THANH'; paymentTermDays: number
  }) {
    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: input.customerId } })
    const vatAmount = Math.round((input.value * company.defaultVatRate) / 100)
    const total = input.value + vatAmount
    const signerLevel = contractSignerLevel(input.type, total, company)
    const signDate = addDays(today, -input.signedDaysAgo)
    const [s, p] = await prisma.$transaction(async (tx) => [
      await seq(tx, COUNTER_KEYS.contract(input.type, year)),
      needsProjectCode(segments[input.segmentId], input.value) ? await seq(tx, COUNTER_KEYS.project(year)) : null,
    ])
    return prisma.contract.create({
      data: {
        number: formatContractNumber(input.type, s, year, customer.code), year, seq: s, type: input.type, title: input.title,
        customerId: input.customerId, quoteId: input.quoteId, segmentId: input.segmentId, value: input.value, vatRate: company.defaultVatRate,
        vatAmount, total, signDate, startDate: signDate, endDate: input.months ? addDays(signDate, input.months * 30) : null,
        paymentTermDays: input.paymentTermDays, advancePercent: input.advancePercent ?? 0, projectCode: p ? formatProjectCode(p, year) : null,
        ownerId: input.ownerId, signerLevel, status: input.status, reviewedById: kt, reviewedAt: at(input.signedDaysAgo + 1),
        approvedById: signerLevel === 'PGD_KINH_DOANH' ? pgdkd : gd, approvedAt: at(input.signedDaysAgo),
        completedAt: input.status === 'HOAN_THANH' ? at(input.signedDaysAgo - 10) : null, createdById: input.ownerId,
      },
    })
  }

  const ctA = await contract({ type: 'THI_CONG', customerId: cA, quoteId: qA.id, segmentId: 'THI_CONG', title: 'Thi công sân vườn biệt thự A', value: 180_000_000, ownerId: nv, signedDaysAgo: 50, advancePercent: 50, status: 'HOAN_THANH', paymentTermDays: 15 })
  const ctB = await contract({ type: 'CHO_THUE', customerId: cB, quoteId: qB.id, segmentId: 'CHO_THUE', title: 'Cho thuê cây sảnh khách sạn B', value: 36_000_000, ownerId: nv, signedDaysAgo: 40, months: 12, status: 'DA_KY', paymentTermDays: 10 })
  const ctC = await contract({ type: 'CHAM_SOC', customerId: cC, segmentId: 'CHAM_SOC', title: 'Chăm sóc cảnh quan Resort C', value: 45_000_000, ownerId: pgdkd, signedDaysAgo: 38, months: 12, status: 'DA_KY', paymentTermDays: 10 })
  const ctD = await contract({ type: 'MUA_BAN', customerId: cD, quoteId: qD.id, segmentId: 'BAN_BUON', title: 'Cung cấp cây văn phòng D', value: 60_000_000, ownerId: nv, signedDaysAgo: 18, status: 'HOAN_THANH', paymentTermDays: 15 })

  async function receivable(input: { contractId: string; customerId: string; ownerId: string; docNo: string; description: string; issuedDaysAgo: number; termDays: number; amount: number; paid?: Array<{ daysAgo: number; amount: number }> }) {
    const issueDate = addDays(today, -input.issuedDaysAgo)
    const paid = (input.paid ?? []).reduce((s, p) => s + p.amount, 0)
    return prisma.receivable.create({
      data: {
        contractId: input.contractId, customerId: input.customerId, ownerId: input.ownerId, docNo: input.docNo, description: input.description,
        issueDate, termDays: input.termDays, dueDate: addDays(issueDate, input.termDays), amount: input.amount, paidAmount: paid, createdById: kt,
        payments: { create: (input.paid ?? []).map((p) => ({ customerId: input.customerId, date: addDays(today, -p.daysAgo), amount: p.amount, method: 'CHUYEN_KHOAN' as const, createdById: kt })) },
      },
    })
  }
  await receivable({ contractId: ctA.id, customerId: cA, ownerId: nv, docNo: 'Tạm ứng đợt 1', description: 'Tạm ứng 50% hợp đồng', issuedDaysAgo: 50, termDays: 3, amount: 97_200_000, paid: [{ daysAgo: 48, amount: 97_200_000 }] })
  await receivable({ contractId: ctA.id, customerId: cA, ownerId: nv, docNo: 'HĐ 0000012', description: 'Thanh toán sau nghiệm thu', issuedDaysAgo: 38, termDays: 15, amount: 97_200_000, paid: [{ daysAgo: 20, amount: 97_200_000 }] })
  await receivable({ contractId: ctB.id, customerId: cB, ownerId: nv, docNo: 'HĐ 0000020', description: 'Tiền thuê cây tháng 1', issuedDaysAgo: 48, termDays: 10, amount: 3_240_000 })
  await receivable({ contractId: ctB.id, customerId: cB, ownerId: nv, docNo: 'HĐ 0000026', description: 'Tiền thuê cây tháng 2', issuedDaysAgo: 18, termDays: 10, amount: 3_240_000 })
  await receivable({ contractId: ctC.id, customerId: cC, ownerId: pgdkd, docNo: 'HĐ 0000021', description: 'Phí chăm sóc tháng 1', issuedDaysAgo: 20, termDays: 10, amount: 4_050_000, paid: [{ daysAgo: 6, amount: 2_700_000 }] })
  await receivable({ contractId: ctD.id, customerId: cD, ownerId: nv, docNo: 'HĐ 0000030', description: 'Cung cấp cây văn phòng', issuedDaysAgo: 12, termDays: 15, amount: 64_800_000 })

  const activities: Prisma.ActivityUncheckedCreateInput[] = [
    { type: 'GOI_DIEN', subject: 'Gọi lại sau gửi báo giá duy trì cảnh quan', customerId: cG, opportunityId: oG.id, assigneeId: pgdkd, dueAt: dateOnlyToInstant(addWorkingDays(addDays(today, -6), 2)), auto: true, createdById: pgdkd },
    { type: 'KHAO_SAT', subject: 'Gửi bản vẽ mặt bằng sơ bộ cho trường F', customerId: cF, opportunityId: oF.id, assigneeId: pgdkt, dueAt: dateOnlyToInstant(addDays(today, 1)), createdById: pgdkd },
    { type: 'NHAC_NO', subject: 'Nhắc khách sạn B thanh toán tiền thuê tháng 1', customerId: cB, assigneeId: nv, dueAt: dateOnlyToInstant(today), createdById: kt },
    { type: 'CHAM_SOC_SAU_BAN', subject: 'Hỏi thăm sau 7 ngày giao cây văn phòng D', customerId: cD, assigneeId: nv, dueAt: dateOnlyToInstant(addDays(today, -1)), auto: true, createdById: nv },
    { type: 'ZALO', subject: 'Tư vấn mẫu chậu cho quán cà phê E', customerId: cE, opportunityId: oE.id, assigneeId: nv, doneAt: at(3, 10), content: 'Khách thích chậu composite màu trắng, ngân sách khoảng 10 triệu', createdById: nv },
    { type: 'GAP_MAT', subject: 'Gặp ban quản lý khu đô thị G', customerId: cG, opportunityId: oG.id, assigneeId: pgdkd, doneAt: at(10, 15), content: 'Ban quản lý cần đơn giá theo tháng, thanh toán theo quý', createdById: pgdkd },
  ]
  for (const a of activities) await prisma.activity.create({ data: a })

  await prisma.companySetting.update({ where: { id: 1 }, data: { demoData: true } })
  console.log('Đã thêm dữ liệu mẫu: 8 khách hàng, 8 cơ hội, 5 báo giá, 4 hợp đồng, 6 khoản công nợ.')
}

async function main() {
  await seedBase()
  if (demo) await seedDemo()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
