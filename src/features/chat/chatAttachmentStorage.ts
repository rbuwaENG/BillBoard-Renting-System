import { uploadPath } from '@/lib/fileKind'
import { supabase } from '@/lib/supabase'

export async function uploadChatAttachment(
  file: File,
  threadId: string,
): Promise<string> {
  const path = uploadPath(threadId, file)
  const { error } = await supabase.storage
    .from('chat-attachments')
    .upload(path, file)
  if (error) throw error
  return path
}

export async function getChatAttachmentUrl(
  path: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('chat-attachments')
    .createSignedUrl(path, 3600)
  if (error) return null
  return data.signedUrl
}
