import type { Metadata } from 'next'
import { HubPage } from '@/components/seo/HubPage'
import { hubs } from '@/content/seo'
import { pageMeta } from '@/lib/site'

const hub = hubs.find((h) => h.path === 'guides')!

export const metadata: Metadata = pageMeta({ title: hub.title, description: hub.description, path: '/' + hub.path })

export default function Page() {
  return <HubPage hub={hub} />
}
