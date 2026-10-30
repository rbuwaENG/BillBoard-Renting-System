export type FileKind = 'image' | 'video' | 'pdf' | 'other'

// 'svg' stays here only so legacy uploads still render as images; new SVG
// uploads are rejected (see IMAGE_MIME_TYPES).
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'avi', 'mkv'])

// Inferred from the stored path's filename — storage paths embed a slug of
// the original filename (see safeStorageName), extension included, so no
// separate "mime type" column is needed to tell what kind of file was shared.
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
  // Stored as `${uuid}-${filename}` — strip the uuid prefix for display (a
  // naive "first dash" split would cut inside the UUID itself).
  return name.replace(UUID_PREFIX_RE, '')
}

// --- Upload MIME allow-lists (mirror storage.buckets.allowed_mime_types,
// migration 0035: explicit lists, no wildcards, so no SVG) ---

// billboard-images, site-assets, and proof-of-posting photos.
export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
] as const

// booking-creatives (creatives, documents) and chat-attachments.
export const MEDIA_MIME_TYPES = [
  ...IMAGE_MIME_TYPES,
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/pdf',
] as const

export const IMAGE_ACCEPT = IMAGE_MIME_TYPES.join(',')
export const MEDIA_ACCEPT = MEDIA_MIME_TYPES.join(',')

export const IMAGE_TYPES_LABEL = 'JPEG, PNG, WebP, GIF or AVIF'
export const MEDIA_TYPES_LABEL = `${IMAGE_TYPES_LABEL} images, MP4, WebM or MOV videos, or PDFs`

// Why `file` can't be uploaded to a bucket that only takes `allowed`, or
// null when it can. `accept` isn't enforced on drag-and-drop (or by every
// file picker), and the bucket rejects the upload with an opaque error.
export function fileTypeError(
  file: Pick<File, 'name' | 'type'>,
  allowed: readonly string[],
  label: string,
): string | null {
  if (allowed.includes(file.type)) return null
  return `"${file.name}" can't be uploaded — use ${label}.`
}

// A storage-safe ASCII slug of `filename`, extension kept: anything outside
// [A-Za-z0-9._-] (spaces, slashes, non-ASCII, …) becomes '-', runs of dots
// collapse so no `..` segment survives, and leading/trailing separators are
// trimmed. The original name is kept separately where it's shown to users.
export function safeStorageName(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? ''
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  const ext = dot > 0 ? base.slice(dot + 1) : ''
  const slug = (text: string) =>
    text
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '') // accents: "é" → "e"
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/\.{2,}/g, '.')
      .replace(/-{2,}/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
  const safeStem = slug(stem).slice(0, 80) || 'file'
  const safeExt = ext
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 10)
    .toLowerCase()
  return safeExt ? `${safeStem}.${safeExt}` : safeStem
}

// `${prefix}/${uuid}-${safe name}` (or just `${uuid}-${safe name}`).
export function uploadPath(prefix: string | null, file: Pick<File, 'name'>) {
  const name = `${crypto.randomUUID()}-${safeStorageName(file.name)}`
  return prefix ? `${prefix}/${name}` : name
}
