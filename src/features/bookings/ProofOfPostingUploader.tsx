import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button, FileDropzone } from '@/components'
import {
  MAX_PROOF_PHOTOS,
  useAddProofOfPosting,
  useBookingDocuments,
} from './useBookingDocuments'

const MAX_SIZE_BYTES = 10 * 1024 * 1024

function errorText(err: unknown): string {
  const message = (err as { message?: unknown } | null)?.message
  return typeof message === 'string' && message ? message : 'Upload failed'
}

interface SelectedFile {
  id: string
  file: File
  error?: string
}

// Owner-side picker for proof-of-posting photos: images only, several at a
// time with previews, capped at MAX_PROOF_PHOTOS per booking (counting the
// photos already shared). Failed files stay selected with their error so
// they can be retried or removed.
export function ProofOfPostingUploader({
  bookingId,
  onDone,
}: {
  bookingId: string
  onDone?: () => void
}) {
  const { data, isLoading } = useBookingDocuments(bookingId)
  const existing = (data ?? []).filter(
    (d) => d.kind === 'proof_of_posting',
  ).length
  const remaining = Math.max(0, MAX_PROOF_PHOTOS - existing)
  const addProof = useAddProofOfPosting()
  const [selected, setSelected] = useState<SelectedFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadedCount, setUploadedCount] = useState(0)

  const previews = useMemo(
    () => selected.map((s) => ({ ...s, url: URL.createObjectURL(s.file) })),
    [selected],
  )
  useEffect(
    () => () => previews.forEach((p) => URL.revokeObjectURL(p.url)),
    [previews],
  )

  function handleFiles(files: File[]) {
    setError(null)
    setUploadedCount(0)
    const images = files.filter((f) => f.type.startsWith('image/'))
    const messages: string[] = []
    if (images.length < files.length)
      messages.push('Only image files can be used as proof of posting.')
    const room = remaining - selected.length
    if (images.length > room) {
      messages.push(
        room <= 0
          ? `You can share at most ${MAX_PROOF_PHOTOS} photos per booking.`
          : `Only ${room} more photo${room === 1 ? '' : 's'} can be added (max ${MAX_PROOF_PHOTOS} per booking).`,
      )
    }
    const accepted = images.slice(0, Math.max(0, room))
    if (messages.length) setError(messages.join(' '))
    if (accepted.length) {
      setSelected((prev) => [
        ...prev,
        ...accepted.map((file) => ({ id: crypto.randomUUID(), file })),
      ])
    }
  }

  async function upload() {
    if (uploading || selected.length === 0) return
    setUploading(true)
    setError(null)
    let ok = 0
    const failed: SelectedFile[] = []
    for (const item of selected) {
      try {
        await addProof.mutateAsync({ bookingId, file: item.file })
        ok += 1
      } catch (err) {
        failed.push({ ...item, error: errorText(err) })
      }
    }
    setSelected(failed)
    setUploadedCount(ok)
    setUploading(false)
    if (failed.length === 0) onDone?.()
  }

  if (isLoading) {
    return (
      <p role="status" className="text-xs text-ink/40 dark:text-paper/40">
        Loading…
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink/60 dark:text-paper/60">
        Share photos of the installed creative — the renter is notified. Photos
        become part of the booking record and can't be removed.{' '}
        <span className="font-mono text-[11px]">
          {existing}/{MAX_PROOF_PHOTOS} shared
        </span>
      </p>

      {remaining > 0 ? (
        <FileDropzone
          accept="image/*"
          multiple
          maxSizeBytes={MAX_SIZE_BYTES}
          hint={`Images only — up to 10MB each, ${remaining} more allowed`}
          disabled={uploading || selected.length >= remaining}
          onFilesSelected={handleFiles}
          onError={setError}
        />
      ) : (
        <p className="text-xs text-ink/50 dark:text-paper/50">
          This booking already has the maximum of {MAX_PROOF_PHOTOS} proof
          photos.
        </p>
      )}

      {previews.length > 0 && (
        <ul
          className="grid grid-cols-3 gap-2 sm:grid-cols-5"
          aria-label="Selected photos"
        >
          {previews.map((p) => (
            <li key={p.id} className="relative">
              <img
                src={p.url}
                alt={`Preview of ${p.file.name}`}
                className="aspect-square w-full border border-ink/10 object-cover dark:border-paper/15"
              />
              {!uploading && (
                <button
                  type="button"
                  aria-label={`Remove ${p.file.name}`}
                  onClick={() =>
                    setSelected((prev) => prev.filter((s) => s.id !== p.id))
                  }
                  className="absolute top-1 right-1 bg-ink/70 p-0.5 text-paper hover:bg-ink"
                >
                  <X className="size-3" />
                </button>
              )}
              {p.error && (
                <p
                  role="alert"
                  className="mt-1 text-[10px] leading-tight text-brand-error"
                >
                  {p.error}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="text-xs text-brand-error">
          {error}
        </p>
      )}
      {uploadedCount > 0 && !uploading && (
        <p role="status" className="text-xs text-brand-success">
          {uploadedCount} photo{uploadedCount === 1 ? '' : 's'} shared with the
          renter.
        </p>
      )}

      {selected.length > 0 && (
        <Button size="sm" onClick={upload} disabled={uploading}>
          {uploading
            ? 'Uploading…'
            : `Upload ${selected.length} photo${selected.length === 1 ? '' : 's'}`}
        </Button>
      )}
    </div>
  )
}
