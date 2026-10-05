import { PageHeader } from '@/components/ui/Card'
import { PinDesigner } from '@/components/design/PinDesigner'

export default function DesignPage() {
  return (
    <div>
      <PageHeader title="Pin designer" description="Make a pin image from a template in under a minute, then schedule it." />
      <PinDesigner />
    </div>
  )
}
