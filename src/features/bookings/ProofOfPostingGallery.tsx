import { useQuery } from '@tanstack/react-query'
import { ImageOff } from 'lucide-react'
import { useMemo } from 'react'
import { getBookingCreativeUrl } from './creativeStorage'
import { useBookingDocuments } from './useBookingDocuments'

// Signed URLs from getBookingCreativeUrl are valid for an hour.
const SIGNED_URL_STALE_MS = 50 * 60 * 1000

// Thumbnails of a booking's proof-of-posting photos (the timeline's "Posted"
// step). Each opens full-size in a new tab via a signed URL — the bucket is
// private, readable by both participants and admins.
export function ProofOfPostingGallery({ bookingId }: { bookingId: string }) {
  const { data, isLoading, isError } = useBookingDocuments(bookingId)
  const proofs = useMemo(
    () => (data ?? []).filter((d) => d.kind === 'proof_of_posting'),
    [data],
  )
  const paths = proofs.map((p) => p.storagePath)

  const urls = useQuery({
    queryKey: ['proof-of-posting-urls', bookingId, paths],
    queryFn: async () => {
      const entries = await Promise.all(
        paths.map(
          async (path) => [path, await getBookingCreativeUrl(path)] as const,
        ),
      )
      return Object.fromEntries(entries) as Record<string, string | null>
    },
    enabled: paths.length > 0,
    staleTime: SIGNED_URL_STALE_MS,
  })

  if (isLoading) {
    return (
      <p role="status" className="text-xs text-ink/40 dark:text-paper/40">
        Loading proof of posting…
      </p>
    )
  }
  if (isError) {
    return (
      <p role="alert" className="text-xs text-brand-error">
        Couldn't load the proof-of-posting photos.
      </p>
    )
  }
  if (proofs.length === 0) return null

  return (
    <div className="border-t border-ink/10 pt-4 dark:border-paper/10">
      <p className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
        Proof of posting · {proofs.length} photo{proofs.length === 1 ? '' : 's'}
      </p>
      <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {proofs.map((doc) => {
          const url = urls.data?.[doc.storagePath]
          return (
            <li key={doc.id}>
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Open ${doc.fileName} full size`}
                  className="block aspect-square overflow-hidden border border-ink/10 hover:border-accent focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none dark:border-paper/15"
                >
                  <img
                    src={url}
                    alt={`Proof of posting: ${doc.fileName}`}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                </a>
              ) : (
                <div
                  className="flex aspect-square items-center justify-center border border-ink/10 bg-paper-dim text-ink/30 dark:border-paper/15 dark:bg-ink dark:text-paper/30"
                  title={
                    urls.isLoading
                      ? 'Loading…'
                      : `${doc.fileName} is unavailable`
                  }
                >
                  {urls.isLoading ? (
                    <span className="font-mono text-[10px]">…</span>
                  ) : (
                    <ImageOff
                      aria-label={`${doc.fileName} is unavailable`}
                      className="size-4"
                    />
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
