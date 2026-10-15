export type FileKind = 'image' | 'video' | 'pdf' | 'other'

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'avi', 'mkv'])

// Inferred from the stored path's filename — storage paths already embed
// the original filename (see uploadBookingCreative/uploadChatAttachment),
// so no separate "mime type" column is needed to tell what kind of file
// was shared.
export function getFileKind(path: string): FileKind {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  if (VIDEO_EXTENSIONS.has(ext)) return 'video'
  if (ext === 'pdf') return 'pdf'
  return 'other'
}

const UUID_PREFIX_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i

export function getFilename(path: string): string {
  const name = path.split('/').pop() ?? path
  // Stored as `${uuid}-${originalFilename}` — strip the uuid prefix for
  // display (a naive "first dash" split would cut inside the UUID itself).
  return name.replace(UUID_PREFIX_RE, '')
}
