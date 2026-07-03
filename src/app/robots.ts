import type { MetadataRoute } from 'next'

// Public games site — indexable — but keep crawlers out of the API and the
// owner-only Shimmer dev tooling.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/shimmer/dev'],
    },
    sitemap: 'https://ather.games/sitemap.xml',
    host: 'https://ather.games',
  }
}
