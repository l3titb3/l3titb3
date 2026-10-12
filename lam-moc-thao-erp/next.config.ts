import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Bản đóng gói Docker dùng chế độ standalone (xem Dockerfile)
  output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined,
  poweredByHeader: false,
  devIndicators: false,
}

export default nextConfig
