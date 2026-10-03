import Anthropic from '@anthropic-ai/sdk'
import { env } from '../env'

const client = env.anthropicKey ? new Anthropic({ apiKey: env.anthropicKey }) : null
const MODEL = 'claude-haiku-4-5-20251001'

export const aiEnabled = () => client !== null

async function ask(prompt: string, maxTokens: number): Promise<string> {
  if (!client) throw new Error('AI is not configured')
  const msg = await client.messages.create({ model: MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] })
  return msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
}

function parseJson<T>(raw: string): T {
  return JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''))
}

export async function pinCopy(input: { title: string; description: string; url?: string; topic?: string }) {
  const raw = await ask(
    `You are a Pinterest SEO writer. Write natural, specific copy that a person would actually pin. No clickbait, no emoji.

Source title: ${input.title}
Source description: ${input.description}
${input.url ? `URL: ${input.url}` : ''}${input.topic ? `\nTopic: ${input.topic}` : ''}

Return ONLY JSON:
{"titles":["<=100 chars, keyword first","alt 2","alt 3"],"description":"<=500 chars: 2 sentences using searchable keywords naturally, a soft call to action, then 3-4 hashtags","alt_text":"<=200 chars describing the image for accessibility"}`,
    600
  )
  const j = parseJson<{ titles: string[]; description: string; alt_text: string }>(raw)
  if (!Array.isArray(j.titles) || !j.titles.length) throw new Error('bad shape')
  return {
    titles: j.titles.slice(0, 3).map((t) => String(t).slice(0, 100)),
    description: String(j.description ?? '').slice(0, 800),
    alt_text: String(j.alt_text ?? '').slice(0, 500),
  }
}

export async function captionOptions(topic: string): Promise<{ title: string; description: string }[]> {
  const raw = await ask(
    `Write 3 different Pinterest pin variants for: "${topic}"

Each has a title (<=100 chars, main keyword near the start) and a description (150-300 chars, 2-3 natural keywords, a soft call to action, 3-4 hashtags at the end). Sound human. No emoji.

Return ONLY JSON: [{"title":"...","description":"..."}, ...]`,
    900
  )
  const arr = parseJson<{ title: string; description: string }[]>(raw)
  return arr.slice(0, 3).map((a) => ({ title: String(a.title).slice(0, 100), description: String(a.description).slice(0, 800) }))
}
