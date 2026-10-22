import type { NextConfig } from 'next'

// 07 §9–10. The nonce-based CSP in 07 §10 needs a per-request nonce, which conflicts with the
// prerendered static shells of cacheComponents; it's settled in R4 (logged in docs/build-log.md).
// Until then: the headers below, and frame-ancestors via CSP.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
]

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: { unoptimized: true }, // images are pre-sized WebP at upload (07 §9)
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
