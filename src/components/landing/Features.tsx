import { BarChart3, CalendarClock, Globe, Layers, MessageSquare, Palette, RefreshCw, ShieldCheck, Wand2 } from 'lucide-react'

export const features = [
  { icon: Layers, title: 'Bulk scheduling', text: 'Drop in up to 200 images or a CSV, write once, and spread the pins across days with a fixed interval or best-time slots.' },
  { icon: Globe, title: 'Website to pins', text: 'Paste a post, product page or a whole sitemap. We find the images and draft titles and descriptions for you to review.' },
  { icon: CalendarClock, title: 'Best-time publishing', text: 'Pins go out in the evening and afternoon hours Pinterest is typically busiest in your timezone, with natural minute offsets instead of robotic on-the-hour posting.' },
  { icon: RefreshCw, title: 'Reliable delivery', text: 'A dedicated publishing service retries temporary Pinterest errors, refreshes your connection automatically and shows exactly why a pin failed.' },
  { icon: Wand2, title: 'AI writer', text: 'Three search-friendly title and description options for any topic. Edit freely before anything is scheduled.' },
  { icon: BarChart3, title: 'Live dashboard and analytics', text: 'Statuses update the moment a pin publishes. See impressions, saves and clicks pulled from Pinterest.' },
  { icon: Palette, title: 'Pin designer', text: 'Make a 1000 x 1500 pin from four templates and six color sets, with or without your own photo, then schedule it in one click. No design skills needed.' },
  { icon: MessageSquare, title: 'Assistant that does the work', text: 'Ask in plain language to schedule a week, retry failures or report on the month. It shows what it will do and waits for your OK.' },
  { icon: ShieldCheck, title: 'Pacing check', text: 'After you schedule, you are told if a day gets crowded or an image repeats, so a big batch does not look like spam to Pinterest.' },
]

export function Features() {
  return (
    <section className="border-y border-line bg-white py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-ink">Built for people who pin every day</h2>
          <p className="mt-3 text-stone-600">The parts of Pinterest marketing that take hours, done in minutes.</p>
        </div>
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title}>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand"><Icon size={20} aria-hidden /></div>
              <h3 className="text-base font-semibold text-ink">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
