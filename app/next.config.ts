import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  serverExternalPackages: ['pino-pretty', 'lokijs', 'encoding'],
}

export default nextConfig
