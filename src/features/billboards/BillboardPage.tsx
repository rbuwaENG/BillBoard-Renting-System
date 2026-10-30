import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { BillboardMark, Button } from '@/components'
import { BillboardDetailContent } from './BillboardDetailDialog'
import { useBillboard } from './useBillboard'

// Shareable /billboards/:id page — the same content as the map's detail
// dialog, rendered full-page. `?booking=<id>` opens on that booking.
export function BillboardPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const {
    data: billboard,
    isLoading,
    isError,
    error,
    refetch,
  } = useBillboard(id)

  useEffect(() => {
    if (billboard) document.title = billboard.title
  }, [billboard])

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <Link
        to={id ? `/?billboard=${encodeURIComponent(id)}` : '/'}
        className="mb-4 inline-flex items-center gap-1 font-mono text-[11px] tracking-widest text-ink/50 uppercase hover:text-ink dark:text-paper/50 dark:hover:text-paper"
      >
        <ArrowLeft className="size-3.5" />
        View on map
      </Link>

      {isLoading ? (
        <p
          role="status"
          className="py-16 text-center text-sm text-ink/40 dark:text-paper/40"
        >
          Loading billboard…
        </p>
      ) : isError ? (
        <div role="alert" className="py-16 text-center">
          <p className="text-sm text-brand-error">
            Couldn't load this billboard.
          </p>
          {error instanceof Error && (
            <p className="mt-1 text-xs text-brand-error/80">{error.message}</p>
          )}
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => refetch()}
          >
            Try again
          </Button>
        </div>
      ) : !billboard ? (
        <div className="flex flex-col items-center py-16 text-center">
          <BillboardMark className="size-10 text-ink/15 dark:text-paper/15" />
          <h1 className="mt-4 font-display text-xl font-semibold tracking-tight">
            Billboard not available
          </h1>
          <p className="mt-2 max-w-sm text-sm text-ink/60 dark:text-paper/60">
            This billboard doesn't exist or is no longer listed.
          </p>
          <Button asChild size="sm" className="mt-6">
            <Link to="/">Browse billboards</Link>
          </Button>
        </div>
      ) : (
        <article className="flex flex-col overflow-hidden border border-ink/10 bg-paper dark:border-paper/15 dark:bg-ink-soft">
          <BillboardDetailContent
            key={billboard.id}
            billboard={billboard}
            userCoords={null}
            initialBookingId={searchParams.get('booking')}
            asPage
            renderTitle={(title) => (
              <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
                {title}
              </h1>
            )}
          />
        </article>
      )}
    </div>
  )
}
