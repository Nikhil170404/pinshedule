import type { Metadata } from 'next'
import { PIN_LIMITS } from '@shared/plans'
import { ToolPage, type ToolMeta } from '@/components/tools/ToolPage'
import { TitleChecker } from '@/components/tools/TitleChecker'
import { pageMeta } from '@/lib/site'

const tool: ToolMeta = {
  path: '/tools/pin-title-description-checker',
  name: 'Pin title and description checker',
  h1: 'Pinterest pin title and description checker',
  intro: `Check a pin's title and description against Pinterest's limits (${PIN_LIMITS.title} and ${PIN_LIMITS.description} characters) and get plain advice on keywords, hashtags and spammy patterns. Free, private, no sign-up.`,
}

export const metadata: Metadata = pageMeta({ title: 'Pinterest pin title and description checker', description: tool.intro, path: tool.path })

export default function Page() {
  return (
    <ToolPage tool={tool} notes={[
      { title: 'What it checks', body: `Length against Pinterest's limits, whether the title and description are too short to be useful, capital letters, hashtags in the wrong place or too many of them, a description that repeats the title, and a keyword repeated so often it reads as stuffing.` },
      { title: 'What it does not do', body: 'It does not score or predict reach. No tool can tell you how a pin will rank. The checks are the limits Pinterest enforces plus habits that usually make a pin easier to find and read.' },
    ]}>
      <TitleChecker />
    </ToolPage>
  )
}
