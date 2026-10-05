import { env } from '../env'
import { openai } from './ai'

export const IMAGE_STYLES = {
  photo: 'a natural, softly lit photograph',
  illustration: 'a clean flat illustration with a limited, harmonious colour palette',
  minimal: 'a minimalist composition with generous empty space',
} as const
export type ImageStyle = keyof typeof IMAGE_STYLES

/**
 * Backgrounds only: image models draw text badly, so the headline is added afterwards in the pin designer.
 * The topic is user input; it is reduced to plain words so it reads as a subject, never as instructions.
 */
export function imagePrompt(topic: string, style: ImageStyle): string {
  const subject = topic.replace(/[<>{}\[\]`"\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
  return `A vertical Pinterest pin background in the style of ${IMAGE_STYLES[style]}. Subject: ${subject}. ` +
    'Compose it with calm space near the top or bottom where a headline can be placed later. ' +
    'No text, letters, numbers, logos, watermarks or recognisable real people.'
}

/** One 2:3 JPEG as a data URL. Throws a plain Error on failure so the caller can refund the quota. */
export async function generateBackground(topic: string, style: ImageStyle): Promise<string> {
  const client = openai()
  if (!client) throw new Error('AI is not configured')
  const res = await client.images.generate({
    model: env.openaiImageModel, prompt: imagePrompt(topic, style), n: 1, size: '1024x1536', quality: 'low', output_format: 'jpeg', output_compression: 85,
  })
  const b64 = res.data?.[0]?.b64_json
  if (!b64) throw new Error('The image service returned nothing')
  return `data:image/jpeg;base64,${b64}`
}
