import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Lâm Mộc Thảo - Quản trị', template: '%s | Lâm Mộc Thảo' },
  description: 'Phần mềm quản trị Công ty TNHH Lâm Mộc Thảo',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  )
}
