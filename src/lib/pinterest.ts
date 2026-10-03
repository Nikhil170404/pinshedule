// Only the OAuth entry point lives on Vercel. All Pinterest API calls run on the Railway worker.
export const PINTEREST_SCOPES = 'user_accounts:read,boards:read,boards:write,pins:read,pins:write'

export function buildPinterestAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.PINTEREST_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/pinterest/callback`,
    response_type: 'code',
    scope: PINTEREST_SCOPES,
    state,
  })
  return `https://www.pinterest.com/oauth/?${params}`
}

export const PINTEREST_API = (process.env.PINTEREST_API_BASE ?? 'https://api.pinterest.com/v5').replace(/\/$/, '')
