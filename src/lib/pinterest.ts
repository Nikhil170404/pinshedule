const PINTEREST_BASE = 'https://api.pinterest.com/v5'

export async function getPinterestBoards(accessToken: string) {
  const res = await fetch(`${PINTEREST_BASE}/boards?page_size=25`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to fetch boards')
  const data = await res.json()
  return data.items ?? []
}

export async function createPin(accessToken: string, pin: {
  board_id: string
  title: string
  description: string
  image_url: string
  link?: string
}) {
  const res = await fetch(`${PINTEREST_BASE}/pins`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      board_id: pin.board_id,
      title: pin.title,
      description: pin.description,
      media_source: { source_type: 'image_url', url: pin.image_url },
      link: pin.link,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? 'Failed to create pin')
  }
  return res.json()
}

export async function refreshPinterestToken(refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: 'pins:read,pins:write,boards:read,boards:write,user_accounts:read',
  })

  const credentials = Buffer.from(
    `${process.env.PINTEREST_CLIENT_ID}:${process.env.PINTEREST_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch('https://api.pinterest.com/v5/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  if (!res.ok) throw new Error('Token refresh failed')
  return res.json()
}

export async function getPinterestAnalytics(accessToken: string, pinId: string) {
  const endDate = new Date().toISOString().split('T')[0]
  const startDate = new Date(Date.now() - 30 * 86400_000).toISOString().split('T')[0]
  const res = await fetch(
    `${PINTEREST_BASE}/pins/${pinId}/analytics?start_date=${startDate}&end_date=${endDate}&metric_types=IMPRESSION,SAVE,OUTBOUND_CLICK`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) return null
  return res.json()
}

export async function getPinterestTrendingKeywords(accessToken: string, query: string) {
  const res = await fetch(
    `${PINTEREST_BASE}/trends/keywords/${encodeURIComponent(query)}/top/keywords?region=US&trend_type=monthly&limit=20`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) return []
  const data = await res.json()
  return data.trends ?? []
}

export function buildPinterestAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.PINTEREST_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/pinterest/callback`,
    response_type: 'code',
    scope: 'pins:read,pins:write,boards:read,boards:write,user_accounts:read',
    state,
  })
  return `https://www.pinterest.com/oauth/?${params}`
}
