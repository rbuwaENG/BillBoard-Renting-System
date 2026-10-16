import { FileText, Image as ImageIcon, Paperclip, Trash2, Video } from 'lucide-react'
import { useState } from 'react'
import { FileDropzone } from '@/components'
import { useAuth } from '@/hooks/useAuth'
import { getFileKind, getFilename } from '@/lib/fileKind'
import { getBookingCreativeUrl } from './creativeStorage'
import {
  useAddBookingDocument,
  useBookingDocuments,
  useRemoveBookingDocument,
  type BookingDocument,
} from './useBookingDocuments'

const ACCEPT = 'image/*,video/*,application/pdf'
const MAX_SIZE_BYTES = 10 * 1024 * 1024

const KIND_ICON = { image: ImageIcon, video: Video, pdf: FileText, other: Paperclip } as const

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface BookingDocumentsProps {
  bookingId: string
  canUpload: boolean
  canRemove?: (doc: BookingDocument) => boolean
}

export function BookingDocuments({ bookingId, canUpload, canRemove }: BookingDocumentsProps) {
  const { user } = useAuth()
  const { data, isLoading } = useBookingDocuments(bookingId)
  const documents = data ?? []
  const addDocument = useAddBookingDocument()
  const removeDocument = useRemoveBookingDocument()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)

  async function handleOpen(doc: BookingDocument) {
    setOpeningId(doc.id)
    const url = await getBookingCreativeUrl(doc.storagePath)
    setOpeningId(null)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
    else setError('Could not open this file — it may have been removed.')
  }

  async function handleFiles(files: File[]) {
    setError(null)
    setUploading(true)
    for (const file of files) {
      try {
        await addDocument.mutateAsync({ bookingId, file })
      } catch {
        setError(`"${file.name}" failed to upload. Please try again.`)
      }
    }
    setUploading(false)
  }

  return (
    <div className="space-y-4">
      {isLoading && <p className="text-sm text-ink/40 dark:text-paper/40">Loading documents…</p>}

      {!isLoading && documents.length === 0 && (
        <p className="py-6 text-center text-sm text-ink/40 dark:text-paper/40">
          No documents yet — artwork, briefs, or logos you attach will appear here.
        </p>
      )}

      {documents.length > 0 && (
        <ul className="space-y-2">
          {documents.map((doc) => {
            const Icon = KIND_ICON[getFileKind(doc.storagePath)]
            const removable = canRemove ? canRemove(doc) : doc.uploadedBy === user?.uid
            return (
              <li
                key={doc.id}
                className="flex items-center gap-2.5 border border-ink/10 px-3 py-2 text-sm dark:border-paper/15"
              >
                <Icon className="size-4 shrink-0 text-ink/50 dark:text-paper/50" />
                <button
                  type="button"
                  onClick={() => handleOpen(doc)}
                  disabled={openingId === doc.id}
                  className="min-w-0 flex-1 truncate text-left hover:underline"
                  title={getFilename(doc.storagePath)}
                >
                  {doc.fileName}
                </button>
                <span className="shrink-0 font-mono text-[11px] text-ink/40 dark:text-paper/40">
                  {formatFileSize(doc.fileSize)}
                </span>
                {removable && (
                  <button
                    type="button"
                    title="Remove"
                    onClick={() => removeDocument.mutate({ documentId: doc.id, bookingId })}
                    className="shrink-0 text-ink/40 hover:text-brand-error dark:text-paper/40"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {canUpload && (
        <div>
          <FileDropzone
            accept={ACCEPT}
            multiple
            maxSizeBytes={MAX_SIZE_BYTES}
            hint="Images, video, or PDF — up to 10MB each"
            disabled={uploading}
            onFilesSelected={handleFiles}
            onError={setError}
          />
          {uploading && (
            <p className="mt-2 font-mono text-[11px] text-ink/50 dark:text-paper/50">Uploading…</p>
          )}
          {error && <p className="mt-2 text-xs text-brand-error">{error}</p>}
        </div>
      )}
    </div>
  )
}
