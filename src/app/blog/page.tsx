import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export const metadata = {
  title: 'Blog — Pinshedule',
  description: 'Pinterest tips, tutorials, and strategies for creators, bloggers, and Etsy sellers.',
}

const posts = [
  {
    slug: 'tailwind-vs-pinshedule',
    title: 'Tailwind vs Pinshedule: Honest Comparison 2026',
    excerpt: 'We compared every feature head-to-head. Here\'s what we found — and why we built this.',
    category: 'Comparison',
    readTime: '5 min read',
    date: 'Jul 20, 2026',
  },
  {
    slug: 'schedule-pinterest-pins-free',
    title: 'How to Schedule Pinterest Pins Automatically (Free Tool)',
    excerpt: 'Step-by-step guide to scheduling your first Pinterest pin automatically in under 5 minutes.',
    category: 'Tutorial',
    readTime: '4 min read',
    date: 'Jul 15, 2026',
  },
  {
    slug: 'best-pinterest-schedulers-2026',
    title: 'Best Pinterest Scheduler Tools 2026 (Ranked by Price)',
    excerpt: 'We tested every Pinterest scheduler so you don\'t have to. Here\'s the full ranking.',
    category: 'Roundup',
    readTime: '8 min read',
    date: 'Jul 10, 2026',
  },
  {
    slug: 'pinterest-pin-descriptions',
    title: 'How to Write Pinterest Pin Descriptions That Get Clicks',
    excerpt: 'The formula behind descriptions that drive saves and link clicks — with real examples.',
    category: 'Tips',
    readTime: '6 min read',
    date: 'Jul 5, 2026',
  },
  {
    slug: 'pinterest-seo-etsy-2026',
    title: 'Pinterest SEO Guide for Etsy Sellers 2026',
    excerpt: 'How to rank your pins in Pinterest search and drive consistent Etsy traffic.',
    category: 'SEO',
    readTime: '10 min read',
    date: 'Jun 28, 2026',
  },
  {
    slug: 'ai-pinterest-captions',
    title: 'How to Use AI to Write Pinterest Captions',
    excerpt: 'Our AI caption tool explained — how it works and how to get the best results.',
    category: 'AI',
    readTime: '4 min read',
    date: 'Jun 20, 2026',
  },
]

const categoryColors: Record<string, string> = {
  Comparison: 'bg-purple-50 text-purple-700',
  Tutorial: 'bg-blue-50 text-blue-700',
  Roundup: 'bg-orange-50 text-orange-700',
  Tips: 'bg-green-50 text-green-700',
  SEO: 'bg-red-50 text-red-700',
  AI: 'bg-indigo-50 text-indigo-700',
}

export default function BlogPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16">
        <div className="py-16 text-center bg-gray-50 border-b border-gray-100">
          <p className="text-sm font-semibold text-[#E60023] uppercase tracking-wider mb-3">Blog</p>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight mb-4">
            Pinterest growth, simplified
          </h1>
          <p className="text-xl text-gray-500 max-w-xl mx-auto">
            Actionable tips and tutorials for Pinterest creators, bloggers, and sellers.
          </p>
        </div>

        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map(({ slug, title, excerpt, category, readTime, date }) => (
                <Link
                  key={slug}
                  href={`/blog/${slug}`}
                  className="group bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-300 overflow-hidden"
                >
                  {/* Image placeholder */}
                  <div className="h-44 bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="#E60023" opacity="0.3">
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
                    </svg>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${categoryColors[category]}`}>
                        {category}
                      </span>
                      <span className="text-xs text-gray-400">{readTime}</span>
                    </div>
                    <h2 className="font-semibold text-gray-900 mb-2 group-hover:text-[#E60023] transition-colors leading-snug">
                      {title}
                    </h2>
                    <p className="text-sm text-gray-500 leading-relaxed mb-4">{excerpt}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">{date}</span>
                      <ArrowRight size={14} className="text-gray-400 group-hover:text-[#E60023] group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
