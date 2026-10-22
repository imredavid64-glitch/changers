import type { MetadataRoute } from 'next'

// Member-only pages are never indexed (07 §8); the old site had no robots.txt (01-RECON).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/home', '/account', '/admin', '/welcome', '/sign-in', '/demo', '/clubs/*/space', '/clubs/*/approvals', '/clubs/*/settings', '/clubs/*/projects/new', '/clubs/*/events/new', '/projects/*/print'] }],
    sitemap: `${process.env.APP_BASE_URL ?? 'http://localhost:4401'}/sitemap.xml`,
  }
}
