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
      // Authenticated pages must never be stored by shared caches.
      { source: '/dashboard/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
    ]
  },
}

export default nextConfig
