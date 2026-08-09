import type { MetadataRoute } from 'next'

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

const routes = [
  '',
  '/onboard',
  '/dashboard',
  '/exporter',
  '/obligor',
  '/investor',
  '/activity',
  '/compliance',
  '/compliance/matrix',
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return routes.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified,
    changeFrequency: 'weekly' as const,
    priority: path === '' ? 1 : 0.7,
  }))
}
