import type { Metadata } from 'next'
import { pageMeta } from '@/lib/site'
import { ToolShell } from '@/components/seo/ToolShell'
import { SRC } from '@/content/seo/facts'
import { PinSizeChecker } from './PinSizeChecker'

export const metadata: Metadata = pageMeta({
  title: 'Free Pinterest pin size checker (1000 x 1500, 2:3)',
  description: 'Check your image against Pinterest pin size rules: 2:3 ratio, 1000 x 1500 px, file size. Free, instant and private. Nothing is uploaded.',
  path: '/tools/pin-size-checker',
})

const faq = [
  { q: 'What is the best Pinterest pin size?', a: 'Pinterest recommends vertical pins in a 2:3 ratio. 1000 x 1500 pixels is the usual choice.' },
  { q: 'Can I use a square or horizontal image?', a: 'Yes, Pinterest accepts them, but tall 2:3 pins take more room in the feed and usually get more attention. Landscape images look small.' },
  { q: 'What happens if my pin is too tall?', a: 'Pins much taller than about 1:2.1 can be cropped or truncated in the feed, so keep important text and the subject toward the top and middle.' },
  { q: 'Is my image uploaded anywhere?', a: 'No. The check runs in your browser, and the image never leaves your device.' },
]

export default function Page() {
  return (
    <ToolShell name="Pinterest pin size checker" path="/tools/pin-size-checker" h1="Free Pinterest pin size checker" intro="Drop in your pin images and see at once whether the size, ratio and file weight suit Pinterest. It takes seconds and runs privately in your browser." faq={faq} sources={[SRC.imageSizeTailwind, SRC.imageSizePubler]}>
      <PinSizeChecker />
    </ToolShell>
  )
}
