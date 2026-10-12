import { expect, test, type Browser, type Page } from '@playwright/test'

const PASSWORD = 'Kiem-thu-2026'
const USERS = {
  gd: 'giamdoc@lammocthao.local',
  pgdkd: 'pgd.kinhdoanh@lammocthao.local',
  kt: 'ketoan@lammocthao.local',
  nv: 'kinhdoanh@lammocthao.local',
}

async function as(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/dang-nhap')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mật khẩu').fill(PASSWORD)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Chào')
  return page
}

test('vòng bán hàng: tiếp nhận → báo giá → duyệt → hợp đồng → ký → thu tạm ứng', async ({ browser }) => {
  // 1. Nhân viên kinh doanh tiếp nhận nhu cầu của khách mới
  const nv = await as(browser, USERS.nv)
  await nv.goto('/co-hoi/moi')
  await nv.getByLabel('Tên khách hàng').fill('Khách sạn Kiểm Thử')
  await nv.getByLabel('Điện thoại').fill('0911 222 333')
  await nv.getByLabel('Nhu cầu của khách').fill('Cải tạo sân vườn khách sạn')
  await nv.getByLabel('Mảng kinh doanh').selectOption('THI_CONG')
  await nv.getByLabel('Giá trị dự kiến (đồng)').fill('120.000.000')
  await nv.getByRole('button', { name: 'Lưu cơ hội' }).click()
  await expect(nv.getByRole('heading', { level: 1 })).toHaveText('Cải tạo sân vườn khách sạn')
  const oppUrl = nv.url()

  // 2. Lập phiếu khảo sát BM-KD-01
  await nv.getByLabel('Diện tích, kích thước khu vực').fill('300 m2')
  await nv.getByRole('button', { name: 'Lưu phiếu khảo sát' }).click()
  await expect(nv.getByText('Đã lưu phiếu khảo sát')).toBeVisible()

  // 3. Lập báo giá từ cơ hội
  await nv.getByRole('link', { name: '+ Lập báo giá' }).click()
  await nv.getByLabel('Tên hạng mục').fill('Thi công sân vườn trọn gói')
  await nv.getByLabel('Đơn vị tính').fill('Gói')
  await nv.getByLabel('Số lượng').fill('1')
  await nv.getByLabel('Đơn giá').fill('80000000')
  await nv.getByLabel('Giá vốn').fill('52000000')
  await expect(nv.getByText('PGĐ Kinh doanh').first()).toBeVisible()
  await nv.getByRole('button', { name: 'Lưu báo giá nháp' }).click()
  await expect(nv.getByRole('heading', { level: 1 })).toContainText('/BG-LMT')
  const quoteUrl = nv.url()
  await nv.getByRole('button', { name: 'Trình duyệt' }).click()
  await expect(nv.getByText('Đang chờ PGĐ phụ trách Kinh doanh duyệt.')).toBeVisible()

  // 4. PGĐ Kinh doanh duyệt (biên 35% đạt sàn 15%, tổng 86,4 triệu dưới 100 triệu)
  const pgd = await as(browser, USERS.pgdkd)
  await pgd.goto(quoteUrl)
  await pgd.getByRole('button', { name: 'Duyệt báo giá' }).click()
  await expect(pgd.getByText(/Đã duyệt: Long/)).toBeVisible()

  // 5. Gửi khách, khách đồng ý, lập hợp đồng
  await nv.goto(quoteUrl)
  await nv.getByRole('button', { name: 'Ghi nhận đã gửi khách' }).click()
  await expect(nv.getByText(/Gửi khách lúc/)).toBeVisible()
  await nv.getByRole('button', { name: 'Khách đồng ý' }).click()
  await nv.getByRole('link', { name: 'Lập hợp đồng từ báo giá' }).click()
  await nv.getByRole('button', { name: 'Lưu hợp đồng (soạn thảo)' }).click()
  await expect(nv.getByRole('heading', { level: 1 })).toContainText('/HĐTC/LMT-')
  const contractUrl = nv.url()

  // 6. Khách tổ chức chưa có MST: không được trình ký
  await nv.getByRole('button', { name: 'Trình duyệt' }).click()
  await expect(nv.getByText('chưa có mã số thuế')).toBeVisible()
  await nv.getByRole('link', { name: 'Khách sạn Kiểm Thử' }).first().click()
  await nv.getByRole('link', { name: 'Sửa' }).click()
  await nv.getByLabel('Mã số thuế').fill('4201234567')
  await nv.getByRole('button', { name: 'Lưu thay đổi' }).click()
  await nv.goto(contractUrl)
  await nv.getByRole('button', { name: 'Trình duyệt' }).click()
  await expect(nv.getByText('Đang chờ Phòng HCKT rà soát.')).toBeVisible()

  // 7. Kế toán rà soát; PGĐ KD không có thẩm quyền ký hợp đồng thi công
  const kt = await as(browser, USERS.kt)
  await kt.goto(contractUrl)
  await kt.getByRole('button', { name: 'Xác nhận đã rà soát hình thức' }).click()
  await expect(kt.getByText(/Rà soát: Kế toán tổng hợp/)).toBeVisible()
  await pgd.goto(contractUrl)
  await expect(pgd.getByRole('button', { name: 'Phê duyệt, ký hợp đồng' })).toHaveCount(0)

  // 8. Giám đốc phê duyệt, ký: cấp mã công trình, tạo khoản tạm ứng 30%
  const gd = await as(browser, USERS.gd)
  await gd.goto(contractUrl)
  await gd.getByRole('button', { name: 'Phê duyệt, ký hợp đồng' }).click()
  await expect(gd.getByText('Đã ký, đang thực hiện').first()).toBeVisible()
  await expect(gd.getByText(/Mã công trình CT-\d{4}-001/)).toBeVisible()
  await expect(gd.getByText('Tạm ứng đợt 1')).toBeVisible()

  // 9. Kế toán thu tạm ứng: 86.400.000 x 30% = 25.920.000
  await kt.goto(contractUrl)
  await kt.getByRole('link', { name: 'Tạm ứng đợt 1' }).click()
  await expect(kt.getByText('25.920.000 đ').first()).toBeVisible()
  await kt.getByRole('button', { name: 'Ghi phiếu thu' }).click()
  await expect(kt.getByText('Đã thu đủ')).toBeVisible()

  // 10. Cơ hội chuyển sang Đã ký; Tổng quan ghi nhận tiền thu
  await nv.goto(oppUrl)
  await expect(nv.getByRole('heading', { name: 'Báo giá' })).toBeVisible()
  await expect(nv.getByRole('heading', { name: 'Cập nhật giai đoạn' })).toHaveCount(0)
  await gd.goto('/')
  await expect(gd.getByText('Tiền đã thu tháng này').locator('..')).toContainText('25,92 triệu')
})

test('phân quyền: nhân viên chỉ thấy khách mình phụ trách', async ({ browser }) => {
  const gd = await as(browser, USERS.gd)
  await gd.goto('/khach-hang/moi')
  await gd.getByLabel('Tên khách hàng').fill('Khách riêng của Giám đốc')
  await gd.getByLabel('Người phụ trách').selectOption({ label: 'Trần Quyết Chiến' })
  await gd.getByRole('button', { name: 'Lưu khách hàng' }).click()
  await expect(gd.getByRole('heading', { level: 1 })).toHaveText('Khách riêng của Giám đốc')
  const url = gd.url()

  const nv = await as(browser, USERS.nv)
  await nv.goto(url)
  await expect(nv.getByText('Không tìm thấy trang hoặc bạn không có quyền xem')).toBeVisible()
  await nv.goto('/thiet-lap/nguoi-dung')
  await expect(nv.getByRole('heading', { level: 1 })).toContainText('Chào')
})

test('khách lẻ không được cho nợ', async ({ browser }) => {
  const gd = await as(browser, USERS.gd)
  await gd.goto('/khach-hang/moi')
  await gd.getByLabel('Tên khách hàng').fill('Anh Khách Lẻ')
  await gd.getByLabel('Loại khách hàng').selectOption('CA_NHAN')
  await gd.getByLabel('Hạn mức nợ (đồng)').fill('5000000')
  await gd.getByRole('button', { name: 'Lưu khách hàng' }).click()
  await expect(gd.getByText('Khách lẻ thanh toán 100% khi giao hàng, không cho nợ')).toBeVisible()
})
