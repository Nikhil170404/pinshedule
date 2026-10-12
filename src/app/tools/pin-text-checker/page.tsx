import type { Metadata } from 'next'
import { pageMeta } from '@/lib/site'
import { ToolShell } from '@/components/seo/ToolShell'
import { FACTS, SRC } from '@/content/seo/facts'
import { PinTextChecker } from './PinTextChecker'

export const metadata: Metadata = pageMeta({
  title: 'Free Pinterest title and description checker',
  description: `Count characters and check keywords in your Pinterest pin title (${FACTS.titleMax} max) and description (${FACTS.descriptionMax} max). Free, instant, private.`,
  path: '/tools/pin-text-checker',
})

const faq = [
  { q: 'How long can a Pinterest pin title be?', a: `Up to ${FACTS.titleMax} characters, but only the first 40 or so usually show in the feed, so lead with the main keyword.` },
  { q: 'How long can a pin description be?', a: `Up to ${FACTS.descriptionMax} characters. The first line matters most because it is what people see first.` },
  { q: 'Where should the keyword go?', a: 'In the title, near the start of the description, and in the image alt text. Write for people first; do not stuff keywords.' },
  { q: 'Does this tool save my text?', a: 'No. Everything runs in your browser and nothing is sent anywhere.' },
]

export default function Page() {
  return (
    <ToolShell name="Pinterest title and description checker" path="/tools/pin-text-checker" h1="Free Pinterest title and description checker" intro="Paste your pin text to count characters against Pinterest's limits and check that your keyword sits where people and search will see it." faq={faq} sources={[SRC.charLimits]}>
      <PinTextChecker />
    </ToolShell>
  )
}
