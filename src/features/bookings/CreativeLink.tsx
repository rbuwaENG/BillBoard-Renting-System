import { FileText, Image as ImageIcon, Paperclip, Video } from 'lucide-react'
import {
  getBookingCreativeUrl,
  getCreativeFilename,
  getCreativeKind,
} from './creativeStorage'

const KIND_ICON = {
  image: ImageIcon,
  video: Video,
  pdf: FileText,
  other: Paperclip,
} as const

const KIND_LABEL = {
  image: 'Image',
  video: 'Video',
  pdf: 'PDF',
  other: 'File',
} as const

export function CreativeLink({ path }: { path: string }) {
  const kind = getCreativeKind(path)
  const Icon = KIND_ICON[kind]

  async function handleClick() {
    const url = await getBookingCreativeUrl(path)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={getCreativeFilename(path)}
      className="mt-2 flex items-center gap-1.5 font-mono text-[11px] tracking-wide text-accent uppercase hover:underline"
    >
      <Icon className="size-3.5" />
      {KIND_LABEL[kind]} attached · view
    </button>
  )
}
