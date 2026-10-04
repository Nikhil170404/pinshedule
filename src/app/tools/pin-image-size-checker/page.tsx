import type { Metadata } from 'next'
import { ToolPage, type ToolMeta } from '@/components/tools/ToolPage'
import { ImageChecker } from '@/components/tools/ImageChecker'
import { pageMeta } from '@/lib/site'

const tool: ToolMeta = {
  path: '/tools/pin-image-size-checker',
  name: 'Pinterest image size checker',
  h1: 'Pinterest image size checker',
  intro: 'Drop in an image to see its size, shape and file size, and whether it suits Pinterest. The recommended pin is a 2:3 vertical image, such as 1000 by 1500 pixels. Runs in your browser; the image is never uploaded.',
}

export const metadata: Metadata = pageMeta({ title: 'Pinterest image size checker', description: 'Check a pin image\'s size, shape and file size against the recommended 2:3 vertical (1000 by 1500 pixels). Free, runs in your browser, nothing is uploaded.', path: tool.path })

export default function Page() {
  return (
    <ToolPage tool={tool} notes={[
      { title: 'The size to aim for', body: 'Pinterest recommends a 2:3 vertical image, for example 1000 by 1500 pixels. Very tall images (taller than about 1:2.1) can be cropped in the feed, and square or wide images take up less space than vertical ones.' },
      { title: 'File types and weight', body: 'JPG, PNG, WEBP and GIF files up to 20 MB work in GoPinKaro. Smaller files load faster, so export at the size you need rather than the largest your camera or design tool produces.' },
    ]}>
      <ImageChecker />
    </ToolPage>
  )
}
