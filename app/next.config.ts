import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['pino-pretty', 'lokijs', 'encoding'],
  outputFileTracingIncludes: {
    '/api/**/*': ['./bundle/**/*'],
  },
}

export default nextConfig
