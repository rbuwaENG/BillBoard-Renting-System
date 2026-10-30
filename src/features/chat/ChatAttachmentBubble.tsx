import { FileText, Image as ImageIcon, Paperclip, Video } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getFileKind, getFilename } from '@/lib/fileKind'
import { getChatAttachmentUrl } from './chatAttachmentStorage'

const KIND_ICON = {
  image: ImageIcon,
  video: Video,
  pdf: FileText,
  other: Paperclip,
} as const

export function ChatAttachmentBubble({ path }: { path: string }) {
  const kind = getFileKind(path)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getChatAttachmentUrl(path).then((signed) => {
      if (active) setUrl(signed)
    })
    return () => {
      active = false
    }
  }, [path])

  if (kind === 'image') {
    return url ? (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img
          src={url}
          alt={getFilename(path)}
          className="max-h-48 max-w-full border border-current/10 object-cover"
        />
      </a>
    ) : (
      <p className="text-xs opacity-60">Loading image…</p>
    )
  }

  if (kind === 'video') {
    return url ? (
      <video
        src={url}
        controls
        className="max-h-48 max-w-full border border-current/10"
      />
    ) : (
      <p className="text-xs opacity-60">Loading video…</p>
    )
  }

  const Icon = KIND_ICON[kind]
  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        if (!url) e.preventDefault()
      }}
      className="flex items-center gap-1.5 text-xs underline"
    >
      <Icon className="size-3.5 shrink-0" />
      {getFilename(path)}
    </a>
  )
}
