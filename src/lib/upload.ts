import { createClient } from '@/lib/supabase/client'

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024

export function validateImage(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return `${file.name}: only JPG, PNG, WEBP or GIF images are supported.`
  if (file.size > MAX_IMAGE_BYTES) return `${file.name}: larger than 20 MB.`
  return null
}

/** Upload to the user's folder in the public pin-images bucket and return its public URL. */
export async function uploadImage(file: File): Promise<string> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Please sign in again.')
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('pin-images').upload(path, file, { contentType: file.type, cacheControl: '31536000' })
  if (error) throw new Error(`Upload failed: ${error.message}`)
  return supabase.storage.from('pin-images').getPublicUrl(path).data.publicUrl
}
