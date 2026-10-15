import { supabase } from '@/lib/supabase'

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
