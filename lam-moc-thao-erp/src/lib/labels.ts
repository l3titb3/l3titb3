import type {
  ActivityType,
  ContractStatus,
  ContractType,
  CustomerStatus,
  CustomerType,
  OpportunityStage,
  PaymentMethod,
  QuoteStatus,
  Role,
  SignerLevel,
} from '@prisma/client'

export const ROLE_LABEL: Record<Role, string> = {
  GIAM_DOC: 'Giám đốc',
  PGD_KINH_DOANH: 'PGĐ phụ trách Kinh doanh',
  PGD_KY_THUAT: 'PGĐ phụ trách Kỹ thuật - Thi công',
  KE_TOAN: 'Hành chính - Kế toán',
  NV_KINH_DOANH: 'Nhân viên kinh doanh',
}

export const CUSTOMER_TYPE_LABEL: Record<CustomerType, string> = {
  CA_NHAN: 'Khách lẻ / cá nhân',
  TO_CHUC: 'Doanh nghiệp, tổ chức',
}

export const CUSTOMER_STATUS_LABEL: Record<CustomerStatus, string> = {
  TIEM_NANG: 'Tiềm năng',
  DANG_GIAO_DICH: 'Đang giao dịch',
  NGUNG: 'Ngừng giao dịch',
}

/** Phân khúc theo nhiệm vụ Phòng KD (Quyết định 01/2026/QĐ-LMT) */
export const INDUSTRIES = [
  'Khách sạn',
  'Resort',
  'Tòa nhà văn phòng',
  'Khu đô thị',
  'Biệt thự, nhà ở',
  'Quán cà phê',
  'Nhà hàng',
  'Trường học',
  'Cơ quan nhà nước',
  'Doanh nghiệp sự kiện',
  'Doanh nghiệp khác',
  'Chủ đầu tư, nhà thầu',
]

/** Kênh tiếp nhận (QT-KD-01 bước 1, nhiệm vụ Marketing) */
export const SOURCES = [
  'Điện thoại',
  'Zalo',
  'Zalo OA',
  'Fanpage',
  'TikTok',
  'Google Business',
  'Website',
  'Giới thiệu',
  'Chủ động tiếp cận',
  'Mời thầu',
]

export const OPPORTUNITY_STAGES: OpportunityStage[] = ['TIEP_NHAN', 'KHAO_SAT', 'BAO_GIA', 'DAM_PHAN', 'THANG', 'THUA']

export const STAGE_LABEL: Record<OpportunityStage, string> = {
  TIEP_NHAN: 'Tiếp nhận',
  KHAO_SAT: 'Khảo sát',
  BAO_GIA: 'Báo giá',
  DAM_PHAN: 'Đàm phán',
  THANG: 'Đã ký',
  THUA: 'Không thành',
}

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  GOI_DIEN: 'Gọi điện',
  ZALO: 'Nhắn Zalo',
  GAP_MAT: 'Gặp trực tiếp',
  EMAIL: 'Email',
  KHAO_SAT: 'Khảo sát',
  GUI_BAO_GIA: 'Gửi báo giá',
  CHAM_SOC_SAU_BAN: 'Chăm sóc sau bán',
  NHAC_NO: 'Nhắc nợ',
  KHIEU_NAI: 'Bảo hành, khiếu nại',
  GHI_CHU: 'Ghi chú',
}

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  NHAP: 'Nháp',
  CHO_DUYET: 'Chờ duyệt',
  DA_DUYET: 'Đã duyệt',
  TU_CHOI: 'Bị trả lại',
  DA_GUI: 'Đã gửi khách',
  THANG: 'Khách đồng ý',
  THUA: 'Không thành',
  HUY: 'Đã hủy',
}

export const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
  MUA_BAN: 'Mua bán cây xanh - vật tư (mẫu 03.1)',
  CHO_THUE: 'Cho thuê cây cảnh (mẫu 03.2)',
  THI_CONG: 'Thi công cảnh quan - hạ tầng (mẫu 03.3)',
  CHAM_SOC: 'Dịch vụ chăm sóc - duy trì (mẫu 03.4)',
  VSMT: 'Vệ sinh môi trường - thu gom rác (mẫu 03.9)',
}

export const CONTRACT_TYPE_SHORT: Record<ContractType, string> = {
  MUA_BAN: 'Mua bán',
  CHO_THUE: 'Cho thuê cây',
  THI_CONG: 'Thi công',
  CHAM_SOC: 'Chăm sóc',
  VSMT: 'Vệ sinh môi trường',
}

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  SOAN_THAO: 'Soạn thảo',
  CHO_DUYET: 'Chờ duyệt ký',
  DA_KY: 'Đã ký, đang thực hiện',
  HOAN_THANH: 'Đã nghiệm thu, giao xong',
  THANH_LY: 'Đã thanh lý',
  HUY: 'Đã hủy',
}

export const SIGNER_LABEL: Record<SignerLevel, string> = {
  PGD_KINH_DOANH: 'PGĐ Kinh doanh',
  GIAM_DOC: 'Giám đốc',
  CHU_TICH: 'Chủ tịch HĐTV',
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CHUYEN_KHOAN: 'Chuyển khoản',
  TIEN_MAT: 'Tiền mặt',
}

export const PRODUCT_GROUPS: Record<string, string> = {
  CX: 'Cây xanh, cây công trình',
  CC: 'Cây chậu, cây cảnh',
  CB: 'Cỏ, cây bụi',
  CH: 'Chậu',
  VT: 'Vật tư, giá thể',
  DV: 'Dịch vụ',
}

export const VAT_RATES = [0, 5, 8, 10]
