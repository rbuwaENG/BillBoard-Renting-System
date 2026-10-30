import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'
import { Button, Card } from '@/components'
import { cn } from '@/lib/utils'

// A failed dynamic import (stale chunk after a deploy, flaky network) — a
// reload fetches the new index.html and fixes it, so say so.
function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /dynamically imported module|Importing a module script failed|Failed to fetch|error loading dynamically/i.test(
    error.message,
  )
}

function describe(error: unknown): { title: string; message: string } {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return {
        title: 'Page not found',
        message: "That page doesn't exist or has moved.",
      }
    }
    return {
      title: `Error ${error.status}`,
      message: error.statusText || 'The page could not be loaded.',
    }
  }
  if (isChunkLoadError(error)) {
    return {
      title: 'Update available',
      message:
        'Part of the app failed to load — usually because a new version was just released or the connection dropped. Reloading should fix it.',
    }
  }
  return {
    title: 'Something went wrong',
    message:
      'An unexpected error stopped this page from loading. Try again, or head back to the browse page.',
  }
}

function errorDetail(error: unknown): string | null {
  if (error instanceof Error) return error.stack || error.message
  if (isRouteErrorResponse(error)) return null
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

/**
 * Route `errorElement`. `fullScreen` is for the root route, where the error
 * replaces the whole layout; nested routes render inside the layout's
 * `<main>` so the header/nav stay usable.
 */
export function RouteErrorBoundary({
  fullScreen = false,
}: {
  fullScreen?: boolean
}) {
  const error = useRouteError()
  const { title, message } = describe(error)
  const detail = import.meta.env.DEV ? errorDetail(error) : null

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center px-4 py-16',
        fullScreen
          ? 'min-h-svh bg-paper text-ink dark:bg-ink dark:text-paper'
          : 'min-h-[calc(100svh-4rem)]',
      )}
    >
      <Card ticks className="w-full max-w-lg p-8 sm:p-10">
        <span className="font-mono text-xs tracking-widest text-accent uppercase">
          Error
        </span>
        <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-ink/60 dark:text-paper/60">{message}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={() => window.location.reload()}>Try again</Button>
          <Button asChild variant="secondary">
            {/* reloadDocument: if the layout itself is what crashed, a
                client-side navigation would just re-render the same error. */}
            <Link to="/" reloadDocument={fullScreen}>
              Go home
            </Link>
          </Button>
        </div>

        {detail && (
          <details className="mt-6 text-xs text-ink/50 dark:text-paper/50">
            <summary className="cursor-pointer font-mono tracking-widest uppercase">
              Details
            </summary>
            <pre className="mt-2 max-h-60 overflow-auto font-mono break-words whitespace-pre-wrap">
              {detail}
            </pre>
          </details>
        )}
      </Card>
    </div>
  )
}
