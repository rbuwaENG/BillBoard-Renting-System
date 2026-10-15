import { supabase } from '@/lib/supabase'

export async function uploadSiteLogo(file: File): Promise<string> {
  const path = `${crypto.randomUUID()}-${file.name}`
  const { error } = await supabase.storage.from('site-assets').upload(path, file)
  if (error) throw error
  const { data } = supabase.storage.from('site-assets').getPublicUrl(path)
  return data.publicUrl
}
