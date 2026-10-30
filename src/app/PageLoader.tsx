import { cn } from '@/lib/utils'

// Shown while a lazily-loaded route's code is fetched on first load.
export function PageLoader({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-center justify-center gap-3 font-mono text-xs tracking-widest text-ink/50 uppercase dark:text-paper/50',
        fullScreen
          ? 'min-h-svh bg-paper dark:bg-ink'
          : 'min-h-[calc(100svh-4rem)]',
      )}
    >
      <span
        aria-hidden="true"
        className="size-3 animate-pulse bg-accent motion-reduce:animate-none"
      />
      Loading…
    </div>
  )
}

// Thin top bar while a client-side navigation waits on a lazy route chunk.
export function NavigationProgress({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      className="fixed inset-x-0 top-0 z-[2100] h-0.5 overflow-hidden bg-accent/20"
    >
      <div className="h-full w-1/3 animate-pulse bg-accent motion-reduce:animate-none" />
    </div>
  )
}
