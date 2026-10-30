import { supabase } from '@/lib/supabase'
import { getFileKind, getFilename, type FileKind } from '@/lib/fileKind'

export type CreativeKind = FileKind
export const getCreativeKind = getFileKind
export const getCreativeFilename = getFilename

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

// Proof-of-posting photos live under `<bookingId>/proof/` in the same bucket —
// the only folder the billboard owner may write to (0033 storage policy).
export async function uploadProofOfPosting(
  file: File,
  bookingId: string,
): Promise<string> {
  const path = `${bookingId}/proof/${crypto.randomUUID()}-${file.name}`
  const { error } = await supabase.storage
    .from('booking-creatives')
    .upload(path, file, { contentType: file.type || undefined })
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
