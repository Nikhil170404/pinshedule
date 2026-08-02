import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { monthlyUsageIncr } from '@/lib/redis'
import { PLANS } from '@/types'
import type { Plan } from '@/types'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = await rateLimit('ai', user.id)
  if (!success) return rateLimitResponse()

  // Check monthly AI generation limit
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('plan')
    .eq('id', user.id)
    .single()
  const plan = (profile?.plan ?? 'free_trial') as Plan
  const aiLimit = PLANS[plan].ai_generations

  const used = await monthlyUsageIncr('ai', user.id)
  if (used !== null && used > aiLimit) {
    return NextResponse.json({
      error: `Monthly AI generation limit reached. ${PLANS[plan].name} plan: ${aiLimit} generations/month.`,
      limit: aiLimit,
      upgrade_required: plan !== 'growth',
    }, { status: 403 })
  }

  const { topic } = await request.json()
  if (!topic?.trim()) return NextResponse.json({ error: 'topic is required' }, { status: 400 })

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [
      {
        role: 'user',
        content: `Write exactly 3 Pinterest pin descriptions for this topic: "${topic}"

Requirements for each:
- 150-200 characters total
- Include 2-3 relevant keywords naturally
- Include a call to action
- End with 4-5 relevant hashtags
- Sound human, not robotic

Format: Return ONLY the 3 descriptions, each on a new line, numbered 1. 2. 3. No extra text.`,
      },
    ],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  const captions = raw
    .split('\n')
    .filter((line) => /^\d\./.test(line.trim()))
    .map((line) => line.replace(/^\d\.\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 3)

  return NextResponse.json({ captions })
}
