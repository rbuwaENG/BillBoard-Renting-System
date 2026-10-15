import { supabase } from '@/lib/supabase'

export type CreativeKind = 'image' | 'video' | 'pdf' | 'other'

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'avi', 'mkv'])

// Inferred from the stored path's filename — the storage path already
// embeds the original filename (see uploadBookingCreative below), so no
// separate "mime type" column is needed to tell renter/rentor what kind of
// file was shared.
export function getCreativeKind(path: string): CreativeKind {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  if (VIDEO_EXTENSIONS.has(ext)) return 'video'
  if (ext === 'pdf') return 'pdf'
  return 'other'
}

const UUID_PREFIX_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i

export function getCreativeFilename(path: string): string {
  const name = path.split('/').pop() ?? path
  // Stored as `${uuid}-${originalFilename}` — strip the uuid prefix for
  // display (a naive "first dash" split would cut inside the UUID itself).
  return name.replace(UUID_PREFIX_RE, '')
}

export async function uploadBookingCreative(
  file: File,
  bookingId: string,
): Promise<string> {
  const path = `${bookingId}/${crypto.randomUUID()}-${file.name}`
  const { error } = await supabase.storage
    .from('booking-creatives')
    .upload(path, file)
  if (error) throw error
  return path
}

export async function getBookingCreativeUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('booking-creatives')
    .createSignedUrl(path, 3600)
  if (error) return null
  return data.signedUrl
}
