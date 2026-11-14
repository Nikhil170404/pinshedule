import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Next.js 16 renamed `middleware` to `proxy`. It only refreshes the session cookie and
// redirects unauthenticated visitors to login and signed-in people from the home page to the dashboard; all real API work happens on the Railway worker.
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/admin/:path*', '/login', '/signup'],
}
