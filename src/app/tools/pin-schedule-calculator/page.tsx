import type { Metadata } from 'next'
import { pageMeta } from '@/lib/site'
import { ToolShell } from '@/components/seo/ToolShell'
import { SRC } from '@/content/seo/facts'
import { PinScheduleCalculator } from './PinScheduleCalculator'

export const metadata: Metadata = pageMeta({
  title: 'Free Pinterest posting frequency calculator',
  description: 'Work out how many pins a day you need to publish a batch over any number of days, and whether the pace is sensible. Free and instant.',
  path: '/tools/pin-schedule-calculator',
})

const faq = [
  { q: 'How many pins should I post a day?', a: 'Pinterest sets no official limit. Guides commonly suggest roughly 5 to 15 a day and warn against repeating the same pin, so treat it as advice and watch your own results.' },
  { q: 'Is it better to post all pins at once?', a: 'Spreading them out is the safer habit. Steady, fresh publishing is what most guides recommend over large bursts.' },
  { q: 'Can I schedule a whole month in one go?', a: 'Yes. A bulk scheduler lets you upload a batch and spread it over the days you choose.' },
]

export default function Page() {
  return (
    <ToolShell name="Pinterest posting frequency calculator" path="/tools/pin-schedule-calculator" h1="Free Pinterest posting frequency calculator" intro="Enter how many pins you have and how many days you want to spread them over. You get the daily pace and whether it sits inside the range guides commonly suggest." faq={faq} sources={[SRC.automationGuide]}>
      <PinScheduleCalculator />
    </ToolShell>
  )
}
