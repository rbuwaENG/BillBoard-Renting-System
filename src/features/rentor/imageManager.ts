import { useEffect, useRef } from 'react'
import {
  fileTypeError,
  getFileKind,
  IMAGE_MIME_TYPES,
  IMAGE_TYPES_LABEL,
} from '@/lib/fileKind'

// Matches the billboard-images bucket limit.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

// One entry in the listing's ordered photo list: an already-stored image
// (public URL) or a newly picked file that's uploaded on save. The first
// entry is the cover.
export type ImageItem =
  | { kind: 'stored'; key: string; url: string }
  | { kind: 'new'; key: string; file: File; previewUrl: string }

export function storedItems(urls: string[]): ImageItem[] {
  return urls.map((url, i) => ({
    kind: 'stored',
    key: `stored-${i}-${url}`,
    url,
  }))
}

export function newItems(
  files: File[],
  createUrl: (file: File) => string = (f) => URL.createObjectURL(f),
): ImageItem[] {
  return files.map((file) => ({
    kind: 'new',
    key: `new-${crypto.randomUUID()}`,
    file,
    previewUrl: createUrl(file),
  }))
}

export function itemSrc(item: ImageItem): string {
  return item.kind === 'stored' ? item.url : item.previewUrl
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (
    from === to ||
    to < 0 ||
    to >= items.length ||
    from < 0 ||
    from >= items.length
  ) {
    return items
  }
  const next = items.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

export function removeAt<T>(items: T[], index: number): T[] {
  return items.filter((_, i) => i !== index)
}

// "Set as cover" = move to the front, keeping everything else's order.
export function makeCover<T>(items: T[], index: number): T[] {
  return moveItem(items, index, 0)
}

// Swap the item with `key` for its uploaded version, in place, so its
// position (and cover status) is preserved.
export function markUploaded(
  items: ImageItem[],
  key: string,
  url: string,
): ImageItem[] {
  return items.map((item) =>
    item.key === key ? { kind: 'stored', key: item.key, url } : item,
  )
}

// Why a picked file can't be added, or null when it's fine. The dropzone's
// `accept` isn't enforced on drag-and-drop, so check the type here too.
export function imageFileError(file: File): string | null {
  const looksLikeImage =
    file.type.startsWith('image/') || getFileKind(file.name) === 'image'
  if (!looksLikeImage) return `"${file.name}" isn't an image.`
  // The bucket only takes an explicit list (no SVG — scriptable).
  const typeProblem = fileTypeError(file, IMAGE_MIME_TYPES, IMAGE_TYPES_LABEL)
  if (typeProblem) return typeProblem
  if (file.size > MAX_IMAGE_BYTES) {
    return `"${file.name}" is too large (max 5MB).`
  }
  return null
}

// Revokes the object URL of every preview that leaves `items` (removed,
// uploaded, or the list reset) and all remaining ones on unmount.
export function useRevokeRemovedPreviews(
  items: ImageItem[],
  revoke: (url: string) => void = (url) => URL.revokeObjectURL(url),
) {
  const previous = useRef<ImageItem[]>([])
  const revokeRef = useRef(revoke)
  useEffect(() => {
    revokeRef.current = revoke
  })

  useEffect(() => {
    const live = new Set(
      items.flatMap((i) => (i.kind === 'new' ? [i.previewUrl] : [])),
    )
    for (const item of previous.current) {
      if (item.kind === 'new' && !live.has(item.previewUrl)) {
        revokeRef.current(item.previewUrl)
      }
    }
    previous.current = items
  }, [items])

  useEffect(
    () => () => {
      for (const item of previous.current) {
        if (item.kind === 'new') revokeRef.current(item.previewUrl)
      }
      previous.current = []
    },
    [],
  )
}
