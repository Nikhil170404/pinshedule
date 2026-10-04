import type { NextConfig } from 'next'

const api = process.env.NEXT_PUBLIC_API_URL ?? ''
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const wsSupabase = supabase.replace(/^http/, 'ws')

// Pin and board images come from arbitrary sites (website import) and Pinterest/Supabase CDNs, so img-src stays open to https.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com" + (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: http://localhost:*",
  "font-src 'self' data:",
  `connect-src 'self' ${supabase} ${wsSupabase} ${api} https://lumberjack.razorpay.com`,
  "frame-src https://api.razorpay.com https://checkout.razorpay.com",
  "form-action 'self' https://www.pinterest.com",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
].join('; ')

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Optimised images are cached for 30 days (the default is 60 seconds) and served as AVIF when the browser supports it.
  images: { minimumCacheTTL: 60 * 60 * 24 * 30, formats: ['image/avif', 'image/webp'] },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.razorpay.com")' },
        ],
      },
      // Images in /public are not fingerprinted, so cache them for a day and let the CDN revalidate quietly for a week.
      { source: '/pins/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }] },
      { source: '/:file(logo[\\w-]*\\.png|icon-\\d+\\.png|og\\.png)', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }] },
      // Authenticated pages must never be stored by shared caches.
      { source: '/dashboard/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
    ]
  },
}

export default nextConfig
